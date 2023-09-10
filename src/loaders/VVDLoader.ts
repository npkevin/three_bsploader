import { FileLoader, Loader } from "three";

class VVDLoader extends Loader {
    load(
        url: string,
        onLoad: (response: any) => void,
        onProgress?: (progress: ProgressEvent) => void,
        onError?: (error: ErrorEvent) => void
    ) {
        const loader = new FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
        loader.setResponseType("arraybuffer");
        loader.load(
            url,
            (resp) => {
                try {
                    if (typeof resp === "string")
                        throw new Error("load(): Expected ArrayBuffer");
                    const result = this.parse(resp);
                    if (onLoad) onLoad(result);
                    return result;
                } catch (err) {
                    onError ? onError(err) : console.error(err);
                }
            },
            onProgress,
            onError
        );
    }
    parse(buffer: ArrayBuffer): any {}
}

export default VVDLoader;
