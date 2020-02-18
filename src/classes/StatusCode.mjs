/* eslint-disable no-magic-numbers */
import enumerable from './Enum'


@enumerable()
/**
 * Enumerable representing HTTP status codes
 * @typedef StatusCode
 * @readonly
 * @enum {number}
 */
export default class StatusCode {
  /**
   * The initial part of a request has been received and has not yet been rejected by the server.
   * The server intends to send a final response after the request has been fully received and acted upon.
   * @type {number}
   * @memberof StatusCode
   */
  static continue = 100

  /**
   * The server understands and is willing to comply with the client's request, via the Upgrade header field1,
   * for a change in the application protocol being used on this connection.
   * @type {number}
   * @memberof StatusCode
   */
  static switchingProtocols = 101

  /**
   * An interim response used to inform the client that the server has accepted the complete request,
   * but has not yet completed it.
   * @type {number}
   * @memberof StatusCode
   */
  static processing = 102

  /**
   * The request has succeeded.
   * @type {number}
   * @memberof StatusCode
   */
  static ok = 200

  /**
   * The request has been fulfilled and has resulted in one or more new resources being created.
   * @type {number}
   * @memberof StatusCode
   */
  static created = 201

  /**
   * The request has been accepted for processing, but the processing has not been completed.
   * The request might or might not eventually be acted upon,
   * as it might be disallowed when processing actually takes place.
   * @type {number}
   * @memberof StatusCode
   */
  static accepted = 202

  /**
   * The request was successful but the enclosed payload has been modified from that of the origin server's 200 OK
   * response by a transforming proxy.
   * @type {number}
   * @memberof StatusCode
   */
  static nonAuthoritativeInformation = 203

  /**
   * The server has successfully fulfilled the request and that there is no additional content
   * to send in the response payload body.
   * @type {number}
   * @memberof StatusCode
   */
  static noContent = 204

  /**
   * The server has fulfilled the request and desires that the user agent reset the "document view",
   * which caused the request to be sent, to its original state as received from the origin server.
   * @type {number}
   * @memberof StatusCode
   */
  static resetContent = 205

  /**
   * The server has fulfilled the request and desires that the user agent reset the "document view",
   * which caused the request to be sent, to its original state as received from the origin server.
   * @type {number}
   * @memberof StatusCode
   */
  static partialContent = 206

  /**
   * A Multi-Status response conveys information about multiple resources in situations where multiple status
   * codes might be appropriate.
   * @type {number}
   * @memberof StatusCode
   */
  static multiStatus = 207

  /**
   * Used inside a DAV: propstat response element to avoid enumerating the internal members of multiple bindings
   * to the same collection repeatedly.
   * @type {number}
   * @memberof StatusCode
   */
  static alreadyReported = 208

  /**
   * The server has fulfilled a GET request for the resource, and the response is a representation of the result
   * of one or more instance-manipulations applied to the current instance.
   * @type {number}
   * @memberof StatusCode
   */
  static imUsed = 226



  /**
   * The target resource has more than one representation, each with its own more specific identifier,
   * and information about the alternatives is being provided so that the user (or user agent) can select a preferred
   * representation by redirecting its request to one or more of those identifiers.
   * @type {number}
   * @memberof StatusCode
   */
  static multipleChoices = 300

  /**
   * The target resource has been assigned a new permanent URI and any future references
   * to this resource ought to use one of the enclosed URIs.
   * @type {number}
   * @memberof StatusCode
   */
  static movedPermanently = 301

  /**
   * The target resource resides temporarily under a different URI. Since the redirection might be altered on occasion,
   * the client ought to continue to use the effective request URI for future requests.
   * @type {number}
   * @memberof StatusCode
   */
  static found = 302

  /**
   * The server is redirecting the user agent to a different resource,
   * as indicated by a URI in the Location header field, which is intended to provide an indirect response to the
   * original request.
   * @type {number}
   * @memberof StatusCode
   */
  static seeOther = 303

  /**
   * A conditional GET or HEAD request has been received and would have resulted in a 200 OK response if it were not
   * for the fact that the condition evaluated to false.
   * @type {number}
   * @memberof StatusCode
   */
  static notModified = 304

  /**
   * The target resource resides temporarily under a different URI and the user agent MUST NOT change the request method
   * if it performs an automatic redirection to that URI.
   * @type {number}
   * @memberof StatusCode
   */
  static temporaryRedirect = 307

  /**
   * The target resource has been assigned a new permanent URI and any future references to this resource ought to
   * use one of the enclosed URIs.
   * @type {number}
   * @memberof StatusCode
   */
  static permanentRedirect = 308


  /**
   * The server cannot or will not process the request due to something that is perceived to be a client error
   * (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
   * @type {number}
   * @memberof StatusCode
   */
  static badRequest = 400

  /**
   * The request has not been applied because it lacks valid authentication credentials for the target resource.
   * @type {number}
   * @memberof StatusCode
   */
  static unauthorised = 401

  /**
   * Reserved for future use.
   * @type {number}
   * @memberof StatusCode
   */
  static paymentRequired = 402

  /**
   * The server understood the request but refuses to authorize it.
   * @type {number}
   * @memberof StatusCode
   */
  static forbidden = 403

  /**
   * The origin server did not find a current representation for the target resource or
   * is not willing to disclose that one exists
   * @type {number}
   * @memberof StatusCode
   */
  static notFound = 404

  /**
   * The method received in the request-line is known by the origin server but not supported by the target resource.
   * @type {number}
   * @memberof StatusCode
   */
  static methodNotAllowed = 405

  /**
   * The target resource does not have a current representation that would be acceptable to the user agent,
   * according to the proactive negotiation header fields received in the request,
   * and the server is unwilling to supply a default representation.
   * @type {number}
   * @memberof StatusCode
   */
  static notAcceptable = 406

  /**
   * Similar to 401 Unauthorized, but it indicates that the client needs to authenticate itself in order to use a proxy.
   * @type {number}
   * @memberof StatusCode
   */
  static proxyAuthenticationRequired = 407

  /**
   * The server did not receive a complete request message within the time that it was prepared to wait.
   * @type {number}
   * @memberof StatusCode
   */
  static requestTimeout = 408

  /**
   * The request could not be completed due to a conflict with the current state of the target resource.
   * This code is used in situations where the user might be able to resolve the conflict and resubmit the request.
   * @type {number}
   * @memberof StatusCode
   */
  static conflict = 409

  /**
   * The target resource is no longer available at the origin server and that this condition is likely to be permanent.
   * @type {number}
   * @memberof StatusCode
   */
  static gone = 410

  /**
   * The server refuses to accept the request without a defined Content-Length.
   * @type {number}
   * @memberof StatusCode
   */
  static lengthRequired = 411

  /**
   * One or more conditions given in the request header fields evaluated to false when tested on the server.
   * @type {number}
   * @memberof StatusCode
   */
  static preconditionFailed = 412

  /**
   * The server is refusing to process a request because the request payload is
   * larger than the server is willing or able to process.
   * @type {number}
   * @memberof StatusCode
   */
  static payloadTooLarge = 413

  /**
   * The server is refusing to service the request because the request-target is
   * longer than the server is willing to interpret.
   * @type {number}
   * @memberof StatusCode
   */
  static requestUriTooLong = 414

  /**
   * The origin server is refusing to service the request because the payload is in a format not supported by
   * this method on the target resource.
   * @type {number}
   * @memberof StatusCode
   */
  static unsupportedMediaType = 415

  /**
   * None of the ranges in the request's Range header field1 overlap the current extent of the selected resource
   * or that the set of ranges requested has been rejected due to invalid ranges or an
   * excessive request of small or overlapping ranges.
   * @type {number}
   * @memberof StatusCode
   */
  static requestedRangeNotSatisfiable = 416

  /**
   * The expectation given in the request's Expect header field could not be met by at least one of the inbound servers.
   * @type {number}
   * @memberof StatusCode
   */
  static expectationFailed = 417

  /**
   * Any attempt to brew coffee with a teapot should result in the error code "418 I'm a teapot".
   * The resulting entity body MAY be short and stout.
   * @type {number}
   * @memberof StatusCode
   */
  static imATeapot = 418

  /**
   * The request was directed at a server that is not able to produce a response.
   * This can be sent by a server that is not configured to produce responses for the combination of scheme and
   * authority that are included in the request URI.
   * @type {number}
   * @memberof StatusCode
   */
  static misdirectedRequest = 421

  /**
   * The server understands the content type of the request entity
   * (hence a 415 Unsupported Media Type status code is inappropriate), and the syntax of the request entity is correct
   * (thus a 400 Bad Request status code is inappropriate) but was unable to process the contained instructions.
   * @type {number}
   * @memberof StatusCode
   */
  static unprocessableEntity = 422

  /**
   * The source or destination resource of a method is locked.
   * @type {number}
   * @memberof StatusCode
   */
  static locked = 423

  /**
   * The method could not be performed on the resource because the
   * requested action depended on another action and that action failed.
   * @type {number}
   * @memberof StatusCode
   */
  static failedDependency = 424

  /**
   * The server refuses to perform the request using the current protocol but might be willing to do so after
   * the client upgrades to a different protocol.
   * @type {number}
   * @memberof StatusCode
   */
  static upgradeRequired = 426

  /**
   * The origin server requires the request to be conditional.
   * @type {number}
   * @memberof StatusCode
   */
  static preconditionRequired = 428

  /**
   * The user has sent too many requests in a given amount of time ("rate limiting").
   * @type {number}
   * @memberof StatusCode
   */
  static tooManyRequests = 429

  /**
   * The server is unwilling to process the request because its header fields are too large.
   * The request MAY be resubmitted after reducing the size of the request header fields.
   * @type {number}
   * @memberof StatusCode
   */
  static requestedHeaderFieldsTooLarge = 431

  /**
   * The server is denying access to the resource as a consequence of a legal demand.
   * @type {number}
   * @memberof StatusCode
   */
  static unavailableForLegalReasons = 451


  /**
   * The server encountered an unexpected condition that prevented it from fulfilling the request.
   * @type {number}
   * @memberof StatusCode
   */
  static internalServerError = 500

  /**
   * The server does not support the functionality required to fulfill the request.
   * @type {number}
   * @memberof StatusCode
   */
  static notImplemented = 501

  /**
   * The server, while acting as a gateway or proxy, received an invalid response from an inbound server it
   * accessed while attempting to fulfill the request.
   * @type {number}
   * @memberof StatusCode
   */
  static badGateway = 502

  /**
   * The server is currently unable to handle the request due to a temporary overload or scheduled maintenance,
   * which will likely be alleviated after some delay.
   * @type {number}
   * @memberof StatusCode
   */
  static serviceUnavailable = 503

  /**
   * The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it
   * needed to access in order to complete the request.
   * @type {number}
   * @memberof StatusCode
   */
  static gatewayTimeout = 504

  /**
   * The server does not support, or refuses to support, the major version of HTTP that was used in the request message.
   * @type {number}
   * @memberof StatusCode
   */
  static httpVersionNotSupported = 505

  /**
   * The server has an internal configuration error: the chosen variant resource is configured to engage in transparent
   * content negotiation itself, and is therefore not a proper end point in the negotiation process.
   * @type {number}
   * @memberof StatusCode
   */
  static variantAlsoNegotiates = 506

  /**
   * The method could not be performed on the resource because the server is unable to store the representation
   * needed to successfully complete the request.
   * @type {number}
   * @memberof StatusCode
   */
  static insufficientStorage = 507

  /**
   * The server terminated an operation because it encountered an infinite loop while processing a request with
   * "Depth: infinity". This status indicates that the entire operation failed.
   * @type {number}
   * @memberof StatusCode
   */
  static loopDetected = 508

  /**
   * The policy for accessing the resource has not been met in the request.
   * The server should send back all the information necessary for the client to issue an extended request.
   * @type {number}
   * @memberof StatusCode
   */
  static notExtended = 510
}
