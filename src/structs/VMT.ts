// References:
// https://developer.valvesoftware.com/wiki/Category:Shader_parameters
// https://developer.valvesoftware.com/wiki/LightmappedGeneric
// https://developer.valvesoftware.com/wiki/WorldVertexTransition

// TODO: add additional params (ex. selfillum 1 => selfillummask <texture>

namespace VMT {
    export type Type = {
        // Basic
        shader?: string;
        basetexture?: string; // <texture>: path relative to <game>/materials/
        surfaceprop?: string; // name
        decal?: boolean; // prevents decal texture clipping
        detail?: string; // <texture>: add high-resolution detail when viewed up close
        model?: boolean; // marks for model rather than brush
        // Adjustment
        color?: number[]; // $color "[ <float> <float> <float> ]" OR $color "{ <int> <int> <int> }"
        seamless_scale?: number; // <float>
        pointsamplemagfilter?: boolean;
        // Transparency
        alpha?: number; //<float> 0-1
        alphatest?: boolean;
        blendmodulatetexture?: string; // <texture>
        distancealpha?: number;
        nocull?: boolean;
        translucent?: boolean;
        // Lighting
        bumpmap?: string; // <texture>
        ssbump?: boolean; // self-shadowed
        selfillum?: boolean; // selfillum ? alpha channel : selfillummask
        lightwarptexture?: string; // <texture>
        halflambert?: boolean; // enables a shader
        ambientocclusion?: number; // <float>: strength of Ambient Occlusion
        rimlight?: boolean; // enables rim lighting (shader)
        receiveflashlight?: boolean;
        lightmap?: string; // <texture>
        // Reflection
        reflectivity?: number[]; // overrides a VTF file's embedded reflectivity
        phong?: boolean;
        envmap?: "env_cubemap";
        // Texture Organization
        keywords?: string[];
    };

    export const Parser = (vmt: string): Type => {
        const result: Type = {};

        const lines = vmt
            .replace(/\\/g, "/")
            .replace(/\t/g, " ") // tabs -> spaces
            .replace(/\r/g, "") // remove return char
            .split("\n")
            .reduce((prev_lines: string[], line: string) => {
                line = line.trim();
                line = line.replace(/\s+/, " ");
                // Empty lines
                if (!line) return prev_lines;
                // Lines comment
                if (line.startsWith("//")) return prev_lines;
                return [...prev_lines, line];
            }, []);

        //shader
        result.shader = removeQuotes(lines[0]).toLowerCase();

        // properties
        const items = lines.slice(1);
        for (const item of items) {
            if (item === "{" || item === "}") continue;

            const key = removeQuotes(
                item.slice(0, item.indexOf(" "))
            ).toLowerCase();
            const value = removeQuotes(
                item.slice(item.indexOf(" ") + 1)
            ).toLowerCase();

            result[cleanKey(key)] = interpretValue(value);
        }
        return result;
    };

    const interpretValue = (text: string) => {
        let match;

        // int[]
        match = text.match(/{\s*([\d\s.]+)\s*}/);
        if (match) {
            const [, ints] = match;
            const int_array = ints
                .trim()
                .split(/\s+/)
                .map((i) => parseInt(i));
            return int_array;
        }
        // float[]
        match = text.match(/\[\s*([\d\s.]+)\s*]/);
        if (match) {
            const [, floats] = match;
            const float_array = floats
                .trim()
                .split(/\s+/)
                .map((f) => parseFloat(f));
            return float_array;
        }
        // any number
        match = text.match(/^(\d*\.?\d+)/);
        if (match) {
            const [, number] = match;
            return parseFloat(number);
        }

        // TODO: complete for other values
        // match = text.match(/VALUES/);
        // if (match) {}

        // TODO: some values include comments
        // ex. `"1"  //how strong the highlights and shadows should be`

        // defualt is string, same val
        return text;
    };
    const cleanKey = (text: string) => {
        if (text.startsWith("$")) return text.replace(/^\$/, "");
        if (text.startsWith("%")) return text.replace(/^\%/, "");
        return text;
    };
    const removeQuotes = (text: string) => {
        if (text.startsWith('"') && text.endsWith('"'))
            return text.replace(/^\"/, "").replace(/\"$/, "");
        return text;
    };
}

export default VMT;
