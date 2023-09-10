import { FileLoader, Group, Loader } from "three";
import MDL from "../structs/MDL";

class MDLLoader extends Loader {
    load(
        url: string,
        onLoad: (response: Group) => void,
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

    parse(buffer: ArrayBuffer): Group {
        const container = new Group();
        const mdl = MDL.Parser(buffer);
        const offset = mdl.header.texture_offset;

        // parse StudioTextures
        for (let i = 0; i < mdl.header.texture_count; i++) {
            const here = offset + i * 64;
            const data = new DataView(buffer, here, 64);
            const studio_texture = MDL.Parsers.StudioTexture(data);

            // get texture name, DNE as a file ???
            const str_data = new DataView(
                buffer,
                here + studio_texture.name_offset
            );
            console.log(this.readUntilNull(str_data));
        }
        return container;
    }

    readUntilNull(data: DataView): string {
        const MAX_CHARS = 128; // arbitrary
        let result = "";
        for (let i = 0; i < MAX_CHARS; i++) {
            const cc = data.getUint8(i);
            if (cc === 0) break;
            result += String.fromCharCode(cc);
        }
        return result;
    }
}

export default MDLLoader;
