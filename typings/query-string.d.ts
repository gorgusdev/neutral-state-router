/**
 * Created by gorgus on 2015-01-08.
 */

interface QueryStringResult {
    [name: string]: string;
}

declare module 'query-string' {

    export function parse(qs: string): QueryStringResult;

    export function stringify(qrs: QueryStringResult): string;

}
