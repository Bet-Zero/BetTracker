/**
 * Custom error thrown when a PageSourceProvider cannot retrieve data.
 */
export class NoSourceDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NoSourceDataError";
    }
}
