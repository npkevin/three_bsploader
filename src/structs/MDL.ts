// Reference:
// https://developer.valvesoftware.com/wiki/MDL_(Source)

import VALVE from "./VALVE";

namespace MDL {
    export type Type = {
        header: Types.Header;
    };

    export const Parser = (buffer: ArrayBuffer): Type => {
        const header = parseHeader(buffer);
        return {
            header,
        };
    };

    const parseHeader = (buffer: ArrayBuffer) => {
        const data = new DataView(buffer, 0, 408);
        const name_array = new Uint8Array(buffer, 12, 64);
        const name = name_array.reduce((str: string, char: number) => {
            if (!char) return str;
            return str + String.fromCharCode(char);
        }, "");
        const header = {
            identifier: data.getInt32(0, true), // Model format ID, such as "IDST" (0x49 0x44 0x53 0x54)
            version: data.getInt32(4, true), // Format version number, such as 48 (0x30,0x00,0x00,0x00)
            checksum: data.getUint32(8, true), // This has to be the same in the phy and vtx files to load!
            name: name, // The internal name of the model, padding with null bytes. Typically "my_model.mdl" will have an internal name of "my_model"
            data_length: data.getInt32(76, true), // Data size of MDL file in bytes.
            eyeposition: {
                // Position of player viewpoint relative to model origin
                x: data.getFloat32(80, true),
                y: data.getFloat32(84, true),
                z: data.getFloat32(88, true),
            },
            illumposition: {
                // Position (relative to model origin) used to calculate ambient light
                // contribution and cubemap reflections for the entire model.
                x: data.getFloat32(92, true),
                y: data.getFloat32(96, true),
                z: data.getFloat32(100, true),
            },
            hull_min: {
                // Corner of model hull box with the least X/Y/Z values
                x: data.getFloat32(104, true),
                y: data.getFloat32(108, true),
                z: data.getFloat32(112, true),
            },
            hull_max: {
                // Opposite corner of model hull box
                x: data.getFloat32(116, true),
                y: data.getFloat32(120, true),
                z: data.getFloat32(124, true),
            },
            view_bbmin: {
                // ???
                x: data.getFloat32(128, true),
                y: data.getFloat32(132, true),
                z: data.getFloat32(136, true),
            },
            view_bbmax: {
                // ???
                x: data.getFloat32(140, true),
                y: data.getFloat32(144, true),
                z: data.getFloat32(148, true),
            },
            // Binary flags in little-endian order.
            // ex (00000001,00000000,00000000,11000000) means flags for position 0, 30, and 31 are set.
            // Set model flags section for more information
            flags: data.getInt32(152, true),
            /*
             * After this point, the header contains many references to offsets
             * within the MDL file and the number of items at those offsets.
             *
             * Offsets are from the very beginning of the file.
             *
             * Note that indexes/counts are not always paired and ordered consistently.
             */

            // mstudiobone_t
            bone_count: data.getInt32(156, true),
            bone_offset: data.getInt32(160, true),

            // mstudiobonecontroller_t
            bonecontroller_count: data.getInt32(164, true),
            bonecontroller_offset: data.getInt32(168, true),

            // mstudiohitboxset_t
            hitbox_count: data.getInt32(172, true),
            hitbox_offset: data.getInt32(176, true),

            // mstudioanimdesc_t
            localanim_count: data.getInt32(180, true),
            localanim_offset: data.getInt32(184, true),

            // mstudioseqdesc_t
            localseq_count: data.getInt32(188, true),
            localseq_offset: data.getInt32(192, true),
            activitylistversion: data.getInt32(196, true), // ??
            eventsindexed: data.getInt32(200, true), // ??

            // VMT texture filenames
            // mstudiotexture_t
            texture_count: data.getInt32(204, true),
            texture_offset: data.getInt32(208, true),

            // This offset points to a series of ints.
            // Each int value, in turn, is an offset relative to the start of this header/the-file,
            // At which there is a null-terminated string.
            texturedir_count: data.getInt32(212, true),
            texturedir_offset: data.getInt32(216, true),

            // Each skin-family assigns a texture-id to a skin location
            skinreference_count: data.getInt32(220, true),
            skinrfamily_count: data.getInt32(224, true),
            skinreference_index: data.getInt32(228, true),

            // mstudiobodyparts_t
            bodypart_count: data.getInt32(232, true),
            bodypart_offset: data.getInt32(236, true),

            // Local attachment points
            // mstudioattachment_t
            attachment_count: data.getInt32(240, true),
            attachment_offset: data.getInt32(244, true),

            // Node values appear to be single bytes, while their names are null-terminated strings.
            localnode_count: data.getInt32(248, true),
            localnode_index: data.getInt32(252, true),
            localnode_name_index: data.getInt32(256, true),

            // mstudioflexdesc_t
            flexdesc_count: data.getInt32(260, true),
            flexdesc_index: data.getInt32(264, true),

            // mstudioflexcontroller_t
            flexcontroller_count: data.getInt32(268, true),
            flexcontroller_index: data.getInt32(272, true),

            // mstudioflexrule_t
            flexrules_count: data.getInt32(276, true),
            flexrules_index: data.getInt32(280, true),

            // IK probably referse to inverse kinematics
            // mstudioikchain_t
            ikchain_count: data.getInt32(284, true),
            ikchain_index: data.getInt32(288, true),

            // Information about any "mouth" on the model for speech animation
            // More than one sounds pretty creepy.
            // mstudiomouth_t
            mouths_count: data.getInt32(292, true),
            mouths_index: data.getInt32(296, true),

            // mstudioposeparamdesc_t
            localposeparam_count: data.getInt32(300, true),
            localposeparam_index: data.getInt32(304, true),

            /*
             * For anyone trying to follow along, as of this writing,
             * the next "surfaceprop_index" value is at position 0x0134 (308)
             * from the start of the file.
             */

            // Surface property value (single null-terminated string)
            surfaceprop_index: data.getInt32(308, true),

            // Unusual: In this one index comes first, then count.
            // Key-value data is a series of strings. If you can't find
            // what you're interested in, check the associated PHY file as well.
            keyvalue_index: data.getInt32(312, true),
            keyvalue_count: data.getInt32(316, true),

            // More inverse-kinematics
            // mstudioiklock_t
            iklock_count: data.getInt32(320, true),
            iklock_index: data.getInt32(324, true),

            mass: data.getFloat32(328, true), // Mass of object (4-bytes)
            contents: data.getInt32(332, true), // ??

            // Other models can be referenced for re-used sequences and animations
            // (See also: The $includemodel QC option.)
            // mstudiomodelgroup_t
            includemodel_count: data.getInt32(336, true),
            includemodel_index: data.getInt32(340, true),

            virtualModel: data.getInt32(344, true), // Placeholder for mutable-void*
            // Note that the SDK only compiles as 32-bit, so anand a pointer are the same size (4 bytes)

            // mstudioanimblock_t
            animblocks_name_index: data.getInt32(348, true),
            animblocks_count: data.getInt32(352, true),
            animblocks_index: data.getInt32(356, true),

            animblockModel: data.getInt32(360, true), // Placeholder for mutable-void*

            // Points to a series of bytes?
            bonetablename_index: data.getInt32(364, true),

            vertex_base: data.getInt32(368, true), // Placeholder for void*
            offset_base: data.getInt32(372, true), // Placeholder for void*

            // Used with $constantdirectionallight from the QC
            // Model should have flag #13 set if enabled
            directionaldotproduct: data.getUint8(376),

            rootLod: data.getUint8(377), // Preferred rather than clamped

            // 0 means any allowed, N means Lod 0 -> (N-1)
            numAllowedRootLods: data.getUint8(378),

            // unused0 ?? 1 byte
            // unused1 ?? 4 byte

            // mstudioflexcontrollerui_t
            flexcontrollerui_count: data.getInt32(384, true),
            flexcontrollerui_index: data.getInt32(388, true),

            vertAnimFixedPointScale: data.getFloat32(392, true), // ??
            // unused2 ?? 4 bytes

            /**
             * Offset for additional header information.
             * May be zero if not present, or also 408 if it immediately
             * follows this studiohdr_t
             */
            // studiohdr2_t
            studiohdr2index: data.getInt32(400, true),

            // unused3 ?? 4 bytes
            // 408 total
        };

        return header;
    };

    export namespace Parsers {
        export const StudioTexture = (data: DataView): Types.StudioTexture => {
            return {
                name_offset: data.getInt32(0, true),
                flags: data.getInt32(4, true),
                // +8 bytes padding
                material: data.getInt32(16, true),
                client_material: data.getInt32(20, true),
                // +40 bytes padding
            };
        };
    }

    export namespace Types {
        export type StudioTexture = {
            // Number of bytes past the beginning of this structure
            // where the first character of the texture name can be found.
            name_offset: number; // Offset for null-terminated string
            flags: number; // int
            // used:   int Padding?
            // unused0: int Padding.
            material: number; // Placeholder for IMaterial
            client_material: number; // Placeholder for void*
            // unused1; int[10] +40 bytes
            // Struct is 64 bytes long
        };
        export type Header = {
            // Not all properties are implemented, only as needed
            identifier: number;
            version: number;
            checksum: number;
            name: string;
            data_length: number;
            eyeposition: VALVE.Vector3;
            illumposition: VALVE.Vector3;
            hull_min: VALVE.Vector3;
            hull_max: VALVE.Vector3;
            view_bbmin: VALVE.Vector3;
            view_bbmax: VALVE.Vector3;
            flags: number;
            bone_count: number;
            bone_offset: number;
            bonecontroller_count: number;
            bonecontroller_offset: number;
            hitbox_count: number;
            hitbox_offset: number;
            localanim_count: number;
            localanim_offset: number;
            localseq_count: number;
            localseq_offset: number;
            activitylistversion: number;
            eventsindexed: number;
            texture_count: number;
            texture_offset: number;
            texturedir_count: number;
            texturedir_offset: number;
            skinreference_count: number;
            skinrfamily_count: number;
            skinreference_index: number;
            bodypart_count: number;
            bodypart_offset: number;
            attachment_count: number;
            attachment_offset: number;
            localnode_count: number;
            localnode_index: number;
            localnode_name_index: number;
            flexdesc_count: number;
            flexdesc_index: number;
            flexcontroller_count: number;
            flexcontroller_index: number;
            flexrules_count: number;
            flexrules_index: number;
            ikchain_count: number;
            ikchain_index: number;
            mouths_count: number;
            mouths_index: number;
            localposeparam_count: number;
            localposeparam_index: number;
            surfaceprop_index: number;
            keyvalue_index: number;
            keyvalue_count: number;
            iklock_count: number;
            iklock_index: number;
            mass: number; // float
            contents: number;
            includemodel_count: number;
            includemodel_index: number;
            virtualModel: number;
            animblocks_name_index: number;
            animblocks_count: number;
            animblocks_index: number;
            animblockModel: number;
            bonetablename_index: number;
            vertex_base: number;
            offset_base: number;
            directionaldotproduct: number;
            rootLod: number;
            numAllowedRootLods: number;
            flexcontrollerui_count: number;
            flexcontrollerui_index: number;
            vertAnimFixedPointScale: number;
            studiohdr2index: number;
        };
    }
}

export default MDL;
