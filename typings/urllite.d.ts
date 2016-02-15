/**
 * Created by gorgus on 2015-01-07.
 */

declare module 'urllite' {

    function urllite(url: string): {
        origin: string;
        protocol: string;
        username: string;
        password: string;
        host: string;
        hostname: string;
        port: string;
        pathname: string;
        search: string;
        hash: string;
    };

    export = urllite;

}