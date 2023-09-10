import VALVE from "./VALVE";
import VBSP from "./BSP";

namespace Entity {
    export type Type = {
        classname: string;
        targetname?: string;
        origin?: VALVE.Vector3;
        model?: number | string;
    };

    export const Parser = (
        buffer: ArrayBuffer,
        header: VBSP.Types.Header
    ): Type[] => {
        const lump = header.lumps[VBSP.LUMP.ENTITIES];
        const data = new Uint8Array(buffer, lump.file_offset, lump.file_length);
        const text = String.fromCharCode(...data);

        const lines = text
            .replace(/\\/g, "/") // blackslash -> forwardslash
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
                // EOF
                if (line === "\0") return prev_lines;
                return [...prev_lines, line];
            }, []);

        const result: Type[] = [];
        let candidate: any;
        for (const line of lines) {
            if (line === "{") {
                candidate = {};
                continue;
            }
            if (line === "}" && candidate) {
                const entity = ctorEntity(candidate);
                result.push(entity);
                candidate = undefined;
                continue;
            }
            const first_space = line.indexOf(" ");
            const key = removeQuotes(line.slice(0, first_space));
            const val = removeQuotes(line.slice(first_space).trim());
            candidate[key] = val;
        }
        return result;
    };
    const ctorEntity = (object: any): Type => {
        if (!object.classname) throw new Error("Not an Entity");
        const entity: Type = {
            ...object,
        };
        // model?
        if (object.model && object.model.startsWith("*")) {
            entity.model = parseInt(
                (object.model as string).replace(/^\*/, "")
            );
        }
        if (object.origin) {
            const [x, y, z] = (object.origin as string).split(" ");
            entity.origin = {
                x: parseFloat(x),
                y: parseFloat(y),
                z: parseFloat(z),
            };
        }
        return entity;
    };

    const removeQuotes = (text: string) => {
        if (text.startsWith('"') && text.endsWith('"'))
            return text.replace(/^\"/, "").replace(/\"$/, "");
        return text;
    };
}

export default Entity;
