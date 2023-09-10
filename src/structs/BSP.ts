// References:
// https://developer.valvesoftware.com/wiki/BSP_(Source)
// https://developer.valvesoftware.com/wiki/BSP_(Source)/Game-Specific

import Entity from "./Entity";
import VALVE from "./VALVE";

namespace BSP {
    const HEADER_LUMPS = 64;
    const MAGIC_LE = 0x50534256; // 'VBSP' (little-endian)
    const MAGIC_BE = 0x56425350; // 'PSBV' (big-endian)

    export const checkMagic = (magic: number) =>
        magic === MAGIC_LE || magic === MAGIC_BE;

    export type Type = {
        header: Types.Header;
        entities: Entity.Type[];
        texDatas: Types.TexData[];
        vertices: VALVE.Vector3[];
        texInfos: Types.TexInfo[];
        faces: Types.Face[];
        edges: Types.Edge[];
        surfEdges: number[]; // -reverse, +forward
        models: Types.Model[];
        games: Types.Game[];
        strTable: number[];
        strData: Types.StringData; // LUMP.TEXDATA_STRING_DATA <offset,vmt_path>
        staticProps?: Types.StaticProps; // leafs are for visibility (occlussion?)
    };

    export const Parser = (buffer: ArrayBuffer): Type => {
        const header: Types.Header = parseHeader(buffer);
        const entities = Entity.Parser(buffer, header);
        const texDatas = parseArray<Types.TexData>(
            buffer,
            header,
            LUMP.TEXDATA,
            Parsers.TexData
        );
        const vertices = parseArray<VALVE.Vector3>(
            buffer,
            header,
            LUMP.VERTEXES,
            Parsers.Vector3
        );
        const texInfos = parseArray<Types.TexInfo>(
            buffer,
            header,
            LUMP.TEXINFO,
            Parsers.TexInfo
        );
        const faces = parseArray<Types.Face>(
            buffer,
            header,
            LUMP.FACES,
            Parsers.Face
        );
        const edges = parseArray<Types.Edge>(
            buffer,
            header,
            LUMP.EDGES,
            Parsers.Edge
        );
        const surfEdges = parseArray<number>(
            buffer,
            header,
            LUMP.SURFEDGES,
            Parsers.Int32
        );
        const models = parseArray<Types.Model>(
            buffer,
            header,
            LUMP.MODELS,
            Parsers.Model
        );
        const strTable = parseArray<number>(
            buffer,
            header,
            LUMP.TEXDATA_STRING_TABLE,
            Parsers.Int32
        );

        const games = parseGames(buffer, header);

        let staticProps: Types.StaticProps | undefined = undefined;
        // games.forEach((game) => {
        //     // static props: 'sprp'
        //     if (game.identifier === 1936749168) {
        //         let offset = game.file_offset;
        //         let length = new Int32Array(buffer, offset, 1)[0];
        //         const names = parseOffset<string>(
        //             buffer,
        //             offset,
        //             length,
        //             Parsers.Str
        //         );
        //         offset += names.length * 128 + 4;
        //         length = new Int32Array(buffer, offset, 1)[0];
        //         const leafs = parseOffset<number>(
        //             buffer,
        //             offset,
        //             length,
        //             Parsers.Uint16
        //         );
        //         offset += leafs.length * 2 + 4;
        //         length = new Int32Array(buffer, offset, 1)[0];
        //         const lumps = parseOffset<Types.StaticProp_V11>(
        //             buffer,
        //             offset,
        //             length,
        //             Parsers.StaticProp
        //         );
        //         staticProps = {
        //             names,
        //             leafs,
        //             lumps,
        //         };
        //     }
        // });

        const strData = parseStringDatas(buffer, header, strTable);
        return {
            header,
            entities,
            texDatas,
            vertices,
            texInfos,
            faces,
            edges,
            surfEdges,
            models,
            games,
            strTable,
            strData,
            staticProps,
        };
    };

    const parseHeader = (buffer: ArrayBuffer): Types.Header => {
        const data = new DataView(buffer, 0, 1036);
        const header: Types.Header = {
            identifier: data.getInt32(0, true), // 1
            version: data.getInt32(4, true), // 1
            lumps: new Array<Types.LumpInfo>(HEADER_LUMPS), // (64 * 4)
            map_revision: data.getInt32(1032, true), // 1
        };
        const offset = 8;
        for (let i = 0, j = 0; i < HEADER_LUMPS * 16; i += 16, j++) {
            header.lumps[j] = {
                file_offset: data.getInt32(offset + i, true),
                file_length: data.getInt32(offset + i + 4, true),
                version: data.getInt32(offset + i + 8, true),
                four_cc: data.getInt32(offset + i + 12, true),
            };
        }
        return header;
    };

    const parseStringDatas = (
        buffer: ArrayBuffer,
        header: Types.Header,
        strTable: number[]
    ): Types.StringData => {
        const result = {};
        const lump = header.lumps[LUMP.TEXDATA_STRING_DATA];
        for (const offset of strTable) {
            const cc_array = new Uint8Array(
                buffer,
                lump.file_offset + offset,
                128 // eh
            );
            let string = "";
            for (let i = 0; i < cc_array.length; i++) {
                const cc = cc_array[i];
                if (cc === 0) break;
                string += String.fromCharCode(cc);
            }
            result[offset] = string;
        }
        return result;
    };

    const parseGames = (
        buffer: ArrayBuffer,
        header: Types.Header
    ): Types.Game[] => {
        const parser = new Parsers.Game();
        const lump = header.lumps[LUMP.GAME];

        const n = new Int32Array(buffer, lump.file_offset, 1)[0]; // 4
        const games: Types.Game[] = new Array<Types.Game>(n);
        for (let i = 0; i < n; i++) {
            const data = new DataView(
                buffer,
                lump.file_offset + 4 + parser.size * i,
                parser.size
            );
            games[i] = parser.parse(data);
        }
        return games;
    };

    const parseOffset = <T>(
        buffer: ArrayBuffer,
        offset: number,
        count: number,
        DictParserClass: new () => Parsers.ILump<T>
    ): T[] => {
        const parser = Parsers.create<T>(DictParserClass);
        const structs: T[] = new Array<T>(count);
        for (let i = 0; i < count; i++) {
            const data = new DataView(
                buffer,
                offset + 4 + parser.size * i,
                parser.size
            );
            structs[i] = parser.parse(data);
        }
        return structs;
    };

    const parseArray = <T>(
        buffer: ArrayBuffer,
        header: Types.Header,
        index: LUMP,
        LumpParserClass: new () => Parsers.ILump<T>
    ): T[] => {
        const parser = Parsers.create<T>(LumpParserClass);
        const lump = header.lumps[index];

        const n = lump.file_length / parser.size;
        const structs: T[] = new Array<T>(n);
        for (let i = 0; i < n; i++) {
            const data = new DataView(
                buffer,
                lump.file_offset + parser.size * i,
                parser.size
            );
            structs[i] = parser.parse(data);
        }
        return structs;
    };

    // Parsers
    //
    //
    namespace Parsers {
        export const create = <T>(
            ParserClass: new () => Parsers.ILump<T>
        ): Parsers.ILump<T> => {
            return new ParserClass();
        };
        export interface ILump<T> {
            readonly size: number;
            parse(data: DataView): T;
        }
        export class Int32 implements ILump<number> {
            readonly size = 4;
            parse(data: DataView): number {
                return data.getInt32(0, true);
            }
        }
        export class Uint16 implements ILump<number> {
            readonly size = 2;
            parse(data: DataView): number {
                return data.getUint16(0, true);
            }
        }
        export class Str implements ILump<string> {
            readonly size = 128;
            parse(data: DataView): string {
                let string = "";
                for (let i = 0; i < data.byteLength; i++) {
                    const cc = data.getInt8(i);
                    if (cc === 0) break;
                    string += String.fromCharCode(cc);
                }
                return string;
            }
        }
        export class Model implements ILump<Types.Model> {
            readonly size = 48;
            parse(data: DataView): Types.Model {
                return {
                    mins: {
                        x: data.getFloat32(0, true),
                        y: data.getFloat32(4, true),
                        z: data.getFloat32(8, true),
                    },
                    maxs: {
                        x: data.getFloat32(12, true),
                        y: data.getFloat32(16, true),
                        z: data.getFloat32(20, true),
                    },
                    origin: {
                        x: data.getFloat32(24, true),
                        y: data.getFloat32(28, true),
                        z: data.getFloat32(32, true),
                    },
                    head_node: data.getInt32(36, true),
                    face_offset: data.getInt32(40, true),
                    face_length: data.getInt32(44, true),
                };
            }
        }
        export class Face implements ILump<Types.Face> {
            readonly size = 56;
            parse(data: DataView): Types.Face {
                return {
                    plane_number: data.getUint16(0, true),
                    side: data.getUint8(2) === 0,
                    on_node: data.getUint8(3) === 1,
                    surf_edge_offset: data.getInt32(4, true),
                    surf_edge_length: data.getInt16(8, true),
                    texinfo_id: data.getInt16(10, true),
                    dispinfo_id: data.getInt16(12, true),
                    surface_fog_volume_id: data.getUint16(14, true),
                    styles: [
                        data.getUint8(16),
                        data.getUint8(17),
                        data.getUint8(18),
                        data.getUint8(19),
                    ],
                    lightmap_offset: data.getInt32(20, true),
                    area: data.getFloat32(24, true),
                    lightmap_tex_mins_lux: [
                        data.getInt32(28, true),
                        data.getInt32(32, true),
                    ],
                    lightmap_tex_size_lux: [
                        data.getInt32(36, true),
                        data.getInt32(40, true),
                    ],
                    original_face: data.getUint32(44, true),
                    primative_length: data.getUint16(48, true),
                    primative_offset: data.getUint16(50, true),
                    smoothing_groups: data.getUint32(52, true), // +4(Uint32) => 56
                };
            }
        }
        export class Edge implements ILump<Types.Edge> {
            size = 4;
            parse(data: DataView): Types.Edge {
                return {
                    p1: data.getUint16(0, true),
                    p2: data.getUint16(2, true),
                };
            }
        }
        export class Vector3 implements ILump<VALVE.Vector3> {
            size = 12;
            parse(data: DataView): VALVE.Vector3 {
                return {
                    x: data.getFloat32(0, true),
                    y: data.getFloat32(4, true),
                    z: data.getFloat32(8, true),
                };
            }
        }
        export class TexInfo implements ILump<Types.TexInfo> {
            readonly size = 72;
            parse(data: DataView): Types.TexInfo {
                return {
                    texture_vector: {
                        s: {
                            x: data.getFloat32(0, true),
                            y: data.getFloat32(4, true),
                            z: data.getFloat32(8, true),
                            w: data.getFloat32(12, true),
                        },
                        t: {
                            x: data.getFloat32(16, true),
                            y: data.getFloat32(20, true),
                            z: data.getFloat32(24, true),
                            w: data.getFloat32(28, true),
                        },
                    },
                    lightmap_vector: {
                        s: {
                            x: data.getFloat32(32, true),
                            y: data.getFloat32(36, true),
                            z: data.getFloat32(40, true),
                            w: data.getFloat32(44, true),
                        },

                        t: {
                            x: data.getFloat32(48, true),
                            y: data.getFloat32(52, true),
                            z: data.getFloat32(56, true),
                            w: data.getFloat32(60, true),
                        },
                    },
                    flag: data.getInt32(64, true) as TEXINFO_FLAG,
                    texdata_id: data.getInt32(68, true),
                };
            }
        }
        export class TexData implements ILump<Types.TexData> {
            readonly size = 32;
            parse(data: DataView): Types.TexData {
                return {
                    reflectivity: {
                        x: data.getFloat32(0, true),
                        y: data.getFloat32(4, true),
                        z: data.getFloat32(8, true),
                    },

                    str_table_id: data.getUint32(12, true),
                    width: data.getUint32(16, true),
                    height: data.getUint32(20, true),
                    view_width: data.getUint32(24, true),
                    view_height: data.getUint32(28, true),
                };
            }
        }
        export class Game implements ILump<Types.Game> {
            size: number = 16;
            parse(data: DataView): Types.Game {
                return {
                    identifier: data.getInt32(0, true),
                    flags: data.getUint16(4, true),
                    version: data.getUint16(6, true),
                    file_offset: data.getInt32(8, true),
                    file_length: data.getInt32(12, true),
                };
            }
        }
        export class StaticProp implements ILump<Types.StaticProp_V11> {
            size: number = 80;
            parse(data: DataView): Types.StaticProp_V11 {
                return {
                    origin: {
                        x: data.getFloat32(0, true),
                        y: data.getFloat32(4, true),
                        z: data.getFloat32(8, true),
                    },
                    q_angle: {
                        x: data.getFloat32(12, true),
                        y: data.getFloat32(16, true),
                        z: data.getFloat32(20, true),
                    },
                    name_id: data.getUint16(24, true), // prop_type
                    leaf_first: data.getUint16(26, true),
                    leaf_count: data.getUint16(28, true),
                    solid: data.getUint8(30),
                    flags: data.getUint8(31),
                    skin: data.getInt32(32, true),
                    fade_dist_min: data.getFloat32(36),
                    fade_dist_max: data.getFloat32(40),
                    lighting_origin: {
                        x: data.getFloat32(44, true),
                        y: data.getFloat32(48, true),
                        z: data.getFloat32(52, true),
                    },
                    forced_fade_scale: data.getFloat32(56, true),
                    cpu_level_min: data.getUint8(60),
                    cpu_level_max: data.getUint8(61),
                    gpu_level_min: data.getUint8(62),
                    gpu_level_max: data.getUint8(63),
                    diffuse_modulation: {
                        r: data.getUint8(64),
                        g: data.getUint8(65),
                        b: data.getUint8(66),
                        a: data.getUint8(67),
                    },
                    disable_x360: data.getUint32(68, true) !== 0,
                    flags_ex: data.getUint32(72, true),
                    uniform_scale: data.getFloat32(76, true),
                };
            }
        }
    }

    // Data Types
    //
    //
    export namespace Types {
        export type Header = {
            identifier: number;
            version: number;
            lumps: LumpInfo[];
            map_revision: number;
        };
        export type LumpInfo = {
            file_offset: number;
            file_length: number;
            version: number; // usually 0
            four_cc: number; // usually 0,0,0,0
        };
        export type Model = {
            mins: VALVE.Vector3;
            maxs: VALVE.Vector3;
            origin: VALVE.Vector3;
            head_node: number;
            face_offset: number;
            face_length: number;
        };
        export type Face = {
            plane_number: number; // Uint16
            side: boolean; // Uint8, 0 = Plane & Face has same direction (aka. 'out')
            on_node: boolean; // Uint8, 1 = Node : 0 = leaf
            surf_edge_offset: number; // Int32, LUMP.SURFEDGES
            surf_edge_length: number; // Int16
            texinfo_id: number; // Int16, LUMP.TEXINFO
            dispinfo_id: number; // Int16, LUMP.DISPINFO (displacement)
            surface_fog_volume_id: number; // Int16, ?
            styles: number[]; // Uint8[4], switchable lighting info
            lightmap_offset: number; // Int32, LUMP.LIGHTMAP* ?
            area: number; // Float32, face area in units^2
            lightmap_tex_mins_lux: number[]; // Int32[2] ?
            lightmap_tex_size_lux: number[]; // Int32[2] ?
            original_face: number; // Int32
            primative_length: number; // Uint16
            primative_offset: number; // Uint16, LUMP.PRIMITIVES
            smoothing_groups: number; // Uint32, Lightmap smoothing group
        };
        export type Edge = {
            // indices for VALVE.Vector3's
            p1: number;
            p2: number;
        };
        export type TexInfo = {
            texture_vector: { s: VALVE.Vector4; t: VALVE.Vector4 }; // [s/t][x,y,z,offset]
            lightmap_vector: { s: VALVE.Vector4; t: VALVE.Vector4 }; // [s/t][x,y,z,offset]
            flag: TEXINFO_FLAG; // miptex flags	overrides
            texdata_id: number;
        };
        export type TexData = {
            reflectivity: VALVE.Vector3; // RGB reflectivity
            str_table_id: number;
            width: number;
            height: number; // source image
            view_width: number;
            view_height: number;
        };
        export interface StringData {
            [key: number]: string;
        }
        export type Game = {
            identifier: number;
            flags: number;
            version: number;
            file_offset: number;
            file_length: number;
        };
        export type StaticProps = {
            names: string[];
            leafs: number[];
            lumps: StaticProp_V11[];
        };
        export type StaticProp_V11 = {
            // v4++
            origin: VALVE.Vector3;
            q_angle: VALVE.Vector3;
            name_id: number; // prop_type
            leaf_first: number;
            leaf_count: number;
            solid: number; // uint8, boolean?
            flags: number; // NOT v7
            skin: number;
            fade_dist_min: number;
            fade_dist_max: number;
            lighting_origin: VALVE.Vector3;
            // v5+
            forced_fade_scale: number;
            // v6 & v7
            // dx_level_min: number;
            // dx_level_max: number;
            // flags: number; // ONLY v7, int32
            // lightmap_res_x: number;
            // lightmap_res_y: number;
            // v8+
            cpu_level_min: number;
            cpu_level_max: number;
            gpu_level_min: number;
            gpu_level_max: number;
            // v7+
            diffuse_modulation: VALVE.Color32;
            disable_x360: boolean; // v9 and v10 only 4 bytes
            // v10+
            flags_ex: number;
            // v11+
            uniform_scale: number;
        };
    }

    // Enums
    //
    //
    export enum TEXINFO_FLAG {
        // Texture Info Flags
        LIGHT = 1 << 0, //value will hold the light strength
        SKY2D = 1 << 1, //don't draw, indicates we should skylight + draw 2d sky but not draw the 3D skybox
        SKY = 1 << 2, //don't draw, but add to skybox
        WARP = 1 << 3, //turbulent water warp
        TRANS = 1 << 4, //texture is translucent
        NOPORTAL = 1 << 5, //the surface can not have a portal placed on it
        TRIGGER = 1 << 6, //FIXME: This is an xbox hack to work around elimination of trigger surfaces, which breaks occluders
        NODRAW = 1 << 7, //don't bother referencing the texture
        HINT = 1 << 8, //make a primary bsp splitter
        SKIP = 1 << 9, //completely ignore, allowing non-closed brushes
        NOLIGHT = 1 << 10, //Don't calculate light
        BUMPLIGHT = 1 << 11, //calculate three lightmaps for the surface for bumpmapping
        NOSHADOWS = 1 << 12, //Don't receive shadows
        NODECALS = 1 << 13, //Don't receive decals
        NOCHOP = 1 << 14, //Don't subdivide patches on this surface
        HITBOX = 1 << 15, //surface is part of a hitbox
    }

    export enum LUMP {
        ENTITIES,
        PLANES,
        TEXDATA,
        VERTEXES,
        VISIBILITY,
        NODES,
        TEXINFO,
        FACES,
        LIGHTING,
        OCCLUSION,
        LEAFS,
        FACEIDS,
        EDGES,
        SURFEDGES,
        MODELS,
        WORLDLIGHTS,
        LEAFFACES,
        LEAFBRUSHES,
        BRUSHES,
        BRUSHSIDES,
        AREAS,
        AREAPORTALS,
        PORTALS = 22,
        UNUSED0 = 22,
        PROPCOLLISION = 22,
        CLUSTERS = 23,
        UNUSED1 = 23,
        PROPHULLS = 23,
        PORTALVERTS = 24,
        UNUSED2 = 24,
        PROPHULLVERTS = 24,
        CLUSTERPORTALS = 25,
        UNUSED3 = 25,
        PROPTRIS = 25,
        DISPINFO,
        ORIGINALFACES,
        PHYSDISP,
        PHYSCOLLIDE,
        VERTNORMALS,
        VERTNORMALINDICES,
        DISP_LIGHTMAP_ALPHAS,
        DISP_VERTS,
        DISP_LIGHTMAP_SAMPLE_POSITIONS,
        GAME,
        LEAFWATERDATA,
        PRIMITIVES,
        PRIMVERTS,
        PRIMINDICES,
        PAKFILE,
        CLIPPORTALVERTS,
        CUBEMAPS,
        TEXDATA_STRING_DATA,
        TEXDATA_STRING_TABLE,
        OVERLAYS,
        LEAFMINDISTTOWATER,
        FACE_MACRO_TEXTURE_INFO,
        DISP_TRIS,
        PHYSCOLLIDESURFACE = 49,
        PROP_BLOB = 49,
        WATEROVERLAYS,
        LIGHTMAPPAGES = 51,
        LEAF_AMBIENT_INDEX_HDR = 51,
        LIGHTMAPPAGEINFOS = 52,
        LEAF_AMBIENT_INDEX = 52,
        LIGHTING_HDR,
        WORLDLIGHTS_HDR,
        LEAF_AMBIENT_LIGHTING_HDR,
        LEAF_AMBIENT_LIGHTING,
        XZIPPAKFILE,
        FACES_HDR,
        MAP_FLAGS,
        OVERLAY_FADES,
        OVERLAY_SYSTEM_LEVELS,
        PHYSLEVEL,
        DISP_MULTIBLEND,
    }
}

export default BSP;
