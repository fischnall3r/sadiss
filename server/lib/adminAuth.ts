/**
 * Who opened a websocket connection.
 *
 * The websocket port is reachable from the internet and takes no credentials,
 * because devices are anonymous and have to stay that way. An operator's
 * interface is not anonymous: it is served from the same origin as the REST API,
 * so the browser sends the login cookie along with the upgrade request and the
 * connection can be tied to an account without the wire carrying anything new.
 *
 * Read once when the socket opens, because the upgrade request is not kept.
 *
 * Locally that means `VITE_APP_API_URL` and `VITE_APP_WS_URL` have to name the
 * same host: the admin logs in against one and opens its socket to the other, and
 * a cookie set for `localhost` is not sent to a LAN address. Ports do not matter.
 */

import { IncomingMessage } from 'http'
import { verifyToken } from '../services/authService'

/** The value of one cookie from a `Cookie` header, if it is there. */
export const readCookie = (header: string | undefined, name: string) =>
  header
    ?.split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/** The account this upgrade request was made by, empty if it carried no valid login. */
export const authenticatedUserId = (request: IncomingMessage) => {
  const token = readCookie(request.headers.cookie, 'jwt')
  return (token && verifyToken(token)) || ''
}
