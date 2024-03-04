import { createContext, type JSXElement, onCleanup, onMount, useContext } from "solid-js"
import { createStore, reconcile, type SetStoreFunction } from "solid-js/store"
import { defaultLocalStorage, type LocalStorageSchema } from "./schema.js"
import { posthog as telemetryBrowser } from "posthog-js"
import { browserAuth } from "@lix-js/server"
import { onSignOut } from "#src/services/auth/index.js"
import { publicEnv } from "@inlang/env-variables"

const LocalStorageContext = createContext()

const LOCAL_STORAGE_KEY = "inlang-local-storage"
const allowedOrigins = publicEnv.PUBLIC_ALLOWED_AUTH_URLS.split(",")

// FIXME: remove user object from localstorage

/**
 * Retrieves (gets) the local storage.
 *
 * This function is supposed to be used in a non-reactive
 * environment (regular JS/TS, not JSX). If a reactive
 * version is required, use `useLocalStorage()` instead.
 */
export function getLocalStorage(): LocalStorageSchema | undefined {
	const json = localStorage.getItem(LOCAL_STORAGE_KEY)
	// we all love javascript. error prevention here if cache contains "undefined"
	if (json && json !== "undefined") {
		return JSON.parse(json)
	}
	return undefined
}

/**
 * Store that provides access to the local storage.
 *
 * Use this function in the context of components.
 * If you need to retrieve the localStorage outside
 * of JSX, use `getLocalStorage()` instead.
 */
export function useLocalStorage(): [
	get: LocalStorageSchema,
	set: SetStoreFunction<LocalStorageSchema>
] {
	return useContext(LocalStorageContext as any)
}

// use strg-f to find the usage of this provider
export function LocalStorageProvider(props: { children: JSXElement }) {
	const [store, setOriginStore] = createStore<LocalStorageSchema>(defaultLocalStorage)

	/** custom setStore to trigger localStorage.setItem on change */
	const setStore: typeof setOriginStore = (...args: any) => {
		// @ts-ignore
		setOriginStore(...args)
		// write to local storage
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store))

		const referrer = document.referrer && new URL(document.referrer).origin
		if (window.opener && allowedOrigins.includes(referrer)) {
			window.opener.postMessage(
				{
					key: LOCAL_STORAGE_KEY,
					newValue: JSON.stringify(store),
				},
				referrer
			)
		}
	}

	// read from local storage on mount
	onMount(() => {
		const storage = getLocalStorage()

		// initialize the user in local storage
		browserAuth
			.getUser()
			.then((userData: { username: string; email: string; avatarUrl?: string }) => {
				const user = { ...userData, isLoggedIn: true }

				if (storage) {
					// set the old local storage data and updated user object together
					storage.user = user
					setStore(storage)
				} else {
					setStore("user", user)
				}

				if (user) {
					telemetryBrowser.identify(user.username)
				}
			})
			// set user to undefined if an error occurs
			.catch(async (err) => {
				if (err.message === "token_invalid") {
					// The token expired or access was revoked by the user and we have a stale token
					await onSignOut({ setLocalStorage: setStore })
					location.reload()
				} else {
					if (storage) {
						// set the old local storage data and removed user object together
						storage.user = { isLoggedIn: false }
						setStore(storage)
					} else {
						setStore("user", { isLoggedIn: false })
					}
				}
			})

		if (typeof window !== "undefined") {
			// listen for changes in other windows
			window.addEventListener("message", onPostMessage, false)
		}
	})

	onCleanup(() => {
		// remove listener
		if (typeof window !== "undefined") {
			window.removeEventListener("message", onPostMessage)
		}
	})

	/** changed in another window should be reflected. thus listen for changes */
	const onPostMessage = (e: { origin: string; data: { key: string; newValue: string } }) => {
		if (allowedOrigins.includes(e.origin)) {
			onStorageSetByOtherWindow(e.data)
		}
	}
	const onStorageSetByOtherWindow = (event: Pick<StorageEvent, "key" | "newValue">) => {
		// if (event.key !== LOCAL_STORAGE_KEY) {
		//   return console.warn(
		//     `unknown localStorage key "${event.key}" was changed by another tab.`
		//   );
		// }
		if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
			// setting the origin store to not trigger a loop
			// using reconcile to ensure that the store is updated
			// even though json.parse and json.stringify are used.
			// read more here https://github.com/solidjs/solid/issues/1407#issuecomment-1344186955
			setOriginStore(reconcile(JSON.parse(event.newValue)))
		}
	}

	return (
		<LocalStorageContext.Provider value={[store, setStore]}>
			{props.children}
		</LocalStorageContext.Provider>
	)
}
