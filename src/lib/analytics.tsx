import React from 'react'
import {AppState, AppStateStatus} from 'react-native'
import {
  createClient,
  AnalyticsProvider,
  useAnalytics as useAnalyticsOrig,
  ClientMethods,
  JsonMap,
} from '@segment/analytics-react-native'
import {RootStoreModel, AppInfo} from 'state/models/root-store'
import {useStores} from 'state/models/root-store'
import {sha256} from 'js-sha256'

const segmentClient = createClient({
  writeKey: '8I6DsgfiSLuoONyaunGoiQM7A6y2ybdI',
  trackAppLifecycleEvents: false,
})

export function useAnalytics() {
  const store = useStores()
  const methods: ClientMethods = useAnalyticsOrig()
  return React.useMemo(() => {
    if (store.session.hasSession) {
      return methods
    }
    // dont send analytics pings for anonymous users
    return {
      screen: (name: string, properties?: JsonMap) => Promise<void>,
      track: (event: string, properties?: JsonMap) => Promise<void>,
      identify: (userId?: string, userTraits?: UserTraits) => Promise<void>,
      flush: () => Promise<void>,
      group: (groupId: string, groupTraits?: GroupTraits) => Promise<void>,
      alias: (newUserId: string) => Promise<void>,
      reset: (resetAnonymousId?: boolean) => Promise<void>,
    }
  }, [store, methods])
}

export function init(store: RootStoreModel) {
  store.onSessionLoaded(() => {
    const sess = store.session.currentSession
    if (sess) {
      if (sess.email) {
        store.log.debug('Ping w/hash')
        const email_hashed = sha256(sess.email)
        segmentClient.identify(email_hashed, {email_hashed})
      } else {
        store.log.debug('Ping w/o hash')
        segmentClient.identify()
      }
    }
  })

  // NOTE
  // this is a copy of segment's own lifecycle event tracking
  // we handle it manually to ensure that it never fires while the app is backgrounded
  // -prf
  segmentClient.isReady.onChange(() => {
    if (AppState.currentState !== 'active') {
      store.log.debug('Prevented a metrics ping while the app was backgrounded')
      return
    }
    const context = segmentClient.context.get()
    if (typeof context?.app === 'undefined') {
      store.log.debug('Aborted metrics ping due to unavailable context')
      return
    }

    const oldAppInfo = store.appInfo
    const newAppInfo = context.app as AppInfo
    store.setAppInfo(newAppInfo)
    store.log.debug('Recording app info', {new: newAppInfo, old: oldAppInfo})

    if (typeof oldAppInfo === 'undefined') {
      if (store.session.hasSession) {
        segmentClient.track('Application Installed', {
          version: newAppInfo.version,
          build: newAppInfo.build,
        })
      }
    } else if (newAppInfo.version !== oldAppInfo.version) {
      if (store.session.hasSession) {
        segmentClient.track('Application Updated', {
          version: newAppInfo.version,
          build: newAppInfo.build,
          previous_version: oldAppInfo.version,
          previous_build: oldAppInfo.build,
        })
      }
    }
    if (store.session.hasSession) {
      segmentClient.track('Application Opened', {
        from_background: false,
        version: newAppInfo.version,
        build: newAppInfo.build,
      })
    }
  })

  let lastState: AppStateStatus = AppState.currentState
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active' && lastState !== 'active') {
      const context = segmentClient.context.get()
      segmentClient.track('Application Opened', {
        from_background: true,
        version: context?.app?.version,
        build: context?.app?.build,
      })
    } else if (state !== 'active' && lastState === 'active') {
      segmentClient.track('Application Backgrounded')
    }
    lastState = state
  })
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <AnalyticsProvider client={segmentClient}>{children}</AnalyticsProvider>
  )
}
