import {
    Loader,
    FileLoader,
    Texture,
    CompressedTexture,
    CompressedPixelFormat,
    RGB_S3TC_DXT1_Format,
    RGBA_S3TC_DXT5_Format,
    RepeatWrapping,
} from "three";
import VTF from "../structs/VTF";

class VTFLoader extends Loader {
    load(
        url: string,
        onLoad: (response: Texture | null) => void,
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
            (buffer) => {
                try {
                    if (typeof buffer === "string")
                        throw new Error("load(): Expected ArrayBuffer");

                    const texture = this.parse(buffer);
                    if (onLoad) onLoad(texture);
                } catch (err) {
                    onError ? onError(err) : console.error(err);
                }
            },
            onProgress,
            onError
        );
    }

    parse(buffer: ArrayBuffer): Texture | null {
        const { header } = VTF.Parser(buffer);

        let tex_format: CompressedPixelFormat;
        let calcSize: (w: number, h: number) => number;

        switch (header.image_format_hi) {
            case VTF.IMAGE_FORMAT.DXT1:
                tex_format = RGB_S3TC_DXT1_Format;
                calcSize = calcSizeDXT1;
                break;
            case VTF.IMAGE_FORMAT.DXT5:
                tex_format = RGBA_S3TC_DXT5_Format;
                calcSize = calcSizeDXT5;
                break;
            default:
                console.warn(
                    `Image Format not supported: ${
                        VTF.IMAGE_FORMAT[header.image_format_hi]
                    }`
                );
                return null;
        }

        const dimensions = calcMipmapLevelDimensions(
            header.width,
            header.height,
            header.mipmap_count
        );
        const mipmaps = new Array<ImageData>(dimensions.length);
        let offset = 0;
        for (let lvl = 0; lvl < dimensions.length; lvl++) {
            const [width, height] = dimensions[lvl];
            const size = calcSize(width, height);
            offset += size;
            mipmaps[lvl] = {
                data: new Uint8ClampedArray(
                    buffer,
                    buffer.byteLength - offset,
                    size
                ),
                width: width,
                height: height,
                colorSpace: "srgb",
            };
        }
        const texture = new CompressedTexture(
            mipmaps,
            header.width,
            header.height,
            tex_format
        );
        texture.anisotropy = 8;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }
}

const calcMipmapLevelDimensions = (
    width: number,
    height: number,
    levels: number
): number[][] => {
    if (levels < 0) return [[width, height]];
    const dx: number[][] = []; // include level 0
    for (let lvl = 0; lvl <= levels; lvl++) {
        dx.push([width, height]);
        if (width === 1 || height === 1) break;
        width >>= 1;
        height >>= 1;
    }
    return dx;
};

const calcSizeDXT1 = (width: number, height: number) =>
    Math.ceil(width / 4) * Math.ceil(height / 4) * 8;

const calcSizeDXT5 = (width: number, height: number) =>
    Math.ceil(width / 4) * Math.ceil(height / 4) * 16;

export default VTFLoader;
