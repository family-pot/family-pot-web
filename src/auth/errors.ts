/** Any failed sign-up or sign-in. The message never says why. */
export class AuthFailedError extends Error {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthFailedError";
  }
}

export class AuthNotConnectedError extends Error {
  constructor(method: string) {
    super(
      `${method} is not available yet: the API auth provider is not connected`,
    );
    this.name = "AuthNotConnectedError";
  }
}
