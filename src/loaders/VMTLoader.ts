import {
    Loader,
    FileLoader,
    Material,
    MeshBasicMaterial,
    MeshStandardMaterial,
} from "three";

import VTFLoader from "./VTFLoader";
import VMT from "../structs/VMT";

class VMTLoader extends Loader {
    load(
        url: string,
        onLoad: (response: Material) => void,
        onProgress?: (progress: ProgressEvent) => void,
        onError?: (error: ErrorEvent) => void
    ) {
        const loader = new FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
        loader.setResponseType("text");
        loader.load(
            url,
            (text) => {
                try {
                    if (typeof text !== "string")
                        throw new Error("load(): Expected String");

                    const vmt = this.parse(text);

                    const loader = new VTFLoader(this.manager).load(
                        `materials/${vmt.basetexture}.vtf`,
                        (texture) => {
                            if (!texture) {
                                const random_coloured_material: Material =
                                    new MeshBasicMaterial({
                                        color: Math.random() * 0xffffff,
                                    });
                                onLoad(random_coloured_material);
                                return;
                            }
                            const material = new MeshStandardMaterial({
                                map: texture,
                            });
                            onLoad(material);
                        }
                    );
                } catch (err) {
                    onError ? onError(err) : console.error(err);
                }
            },
            onProgress,
            onError
        );
    }

    parse(text: string): VMT.Type {
        return VMT.Parser(text);
    }
}

export default VMTLoader;
