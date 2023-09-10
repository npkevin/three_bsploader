import {
    Loader,
    FileLoader,
    BufferGeometry,
    BufferAttribute,
    Mesh,
    Group,
    Vector2,
    Vector3,
} from "three";

import VMTLoader from "./VMTLoader";
import MDLLoader from "./MDLLoader";
import BSP from "../structs/BSP";

export class BSPLoader extends Loader {
    bsp: BSP.Type;

    load(
        url: string,
        onLoad: (response: Group) => void,
        onProgress?: (progress: ProgressEvent) => void,
        onError?: (error: ErrorEvent) => void
    ): void {
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
                } catch (err) {
                    onError ? onError(err) : console.error(err);
                }
            },
            onProgress,
            onError
        );
    }

    parse(buffer: ArrayBuffer): Group {
        const magic: number = new Int32Array(buffer, 0, 1)[0];
        if (!BSP.checkMagic(magic))
            throw new Error(`Invalid BSP Magic: ${magic}`);

        this.bsp = BSP.Parser(buffer);
        console.log(this.bsp);

        const container = new Group();
        this.loadWorldSpawn(container);
        // this.loadEntities(container);
        // this.loadStaticProps(container);
        return container;
    }

    // Helpers
    //
    //
    private loadWorldSpawn = (container: Group) => {
        const world_model = this.bsp.models[0];
        const world_group = this.loadModel(world_model);
        container.add(world_group);
    };

    private loadEntities = (container: Group) => {
        // Handle entities
        this.bsp.entities.forEach((entity) => {
            // set entity's origin and load model if possible
            if (entity.origin && entity.model) {
                if (typeof entity.model === "number") {
                    const model_group = this.loadModel(
                        this.bsp.models[entity.model]
                    );
                    model_group.position.set(
                        entity.origin.x,
                        entity.origin.z,
                        -entity.origin.y
                    );
                    container.add(model_group);
                } else {
                    // model is a string (load .mdl)
                }
            }
            // Entity specific scripts
            switch (entity.classname) {
                case "func_brush":
                case "light":
                case "light_spot":
                case "light_environment":
                case "func_occluder":
                case "func_clip_vphysics":
                case "func_buyzone":
                case "func_bomb_target":
                case "func_areaportal":
                case "trigger_multiple":
                default:
                    console.warn(
                        `Entity not Implemented: ${entity.classname}`,
                        entity
                    );
                    break;
            }
        });
    };

    private loadStaticProps = (container: Group) => {
        if (this.bsp.staticProps) {
            const { names, lumps } = this.bsp.staticProps;
            lumps.forEach((sprp) => {
                const loader = new MDLLoader(this.manager);
                loader.load(names[sprp.name_id], (sprp_group) => {
                    container.add(sprp_group);
                });
            });
        }
    };

    private loadModel = (model: BSP.Types.Model): Group => {
        const model_vertices: Vector3[] = [];
        const model_uvs: Vector2[] = [];
        const model_indices: number[] = [];

        const vmt_indices: Record<string, number[]> = {}; // vmt_path: indices
        for (const face of this.getFaces(model)) {
            const face_vertices: Vector3[] = this.getVertices(face);
            const face_uvs = this.getUVs(face, face_vertices);
            const face_indices = this.getIndices(face, model_vertices.length);

            // cache/seperate indices by vmt_path
            const vmpt_path = this.getVmtPath(face);
            if (!vmt_indices[vmpt_path]) vmt_indices[vmpt_path] = face_indices;
            else vmt_indices[vmpt_path].push(...face_indices);

            model_vertices.push(...face_vertices);
            model_uvs.push(...face_uvs);
            model_indices.push(...face_indices);
        }

        // Flatten data
        const vertices = new Float32Array(model_vertices.length * 3);
        for (let i = 0, j = 0; i < model_vertices.length; i++) {
            vertices[j++] = model_vertices[i].x;
            vertices[j++] = model_vertices[i].y;
            vertices[j++] = model_vertices[i].z;
        }
        const uvs = new Float32Array(model_uvs.length * 2);
        for (let i = 0, j = 0; i < model_uvs.length; i++) {
            uvs[j++] = model_uvs[i].x;
            uvs[j++] = model_uvs[i].y;
        }
        // Shared arrays
        const vertex_array = new BufferAttribute(vertices, 3);
        const uv_array = new BufferAttribute(uvs, 2);

        // Create a mesh for each 'texture'/vmt
        const container = new Group();
        Object.entries(vmt_indices).forEach(([vmt_path, indices]) => {
            // TODO: ignore skybox for now, makes it hard to see without a skybox shader
            if (vmt_path.match(/TOOLSSKYBOX/)) return;

            const submesh_geometry = new BufferGeometry();
            const index = new BufferAttribute(new Uint32Array(indices), 1);
            submesh_geometry.setAttribute("position", vertex_array);
            submesh_geometry.setAttribute("uv", uv_array);
            submesh_geometry.setIndex(index);
            submesh_geometry.computeVertexNormals();
            new VMTLoader(this.manager).load(
                `materials/${vmt_path.toLowerCase()}.vmt`,
                (material) => {
                    const submesh = new Mesh(submesh_geometry, material);
                    container.add(submesh);
                }
            );
        });
        return container;
    };

    private getVmtPath = (face: BSP.Types.Face): string => {
        const bsp = this.bsp;
        const tex_info = bsp.texInfos[face.texinfo_id];
        const tex_data = bsp.texDatas[tex_info.texdata_id];
        const table_id = tex_data.str_table_id;
        const offset = bsp.strTable[table_id];
        const vmt_path = bsp.strData[offset];
        if (!vmt_path) throw new Error(`No VMT for face: ${face}`);
        return vmt_path;
    };

    private getUVs = (face: BSP.Types.Face, vertices: Vector3[]): Vector2[] => {
        const bsp = this.bsp;
        const UVs = new Array<Vector2>(vertices.length);
        const texInfo = bsp.texInfos[face.texinfo_id];
        const texData = bsp.texDatas[texInfo.texdata_id];
        const tS = new Vector3(
            texInfo.texture_vector.s.x,
            texInfo.texture_vector.s.z,
            -texInfo.texture_vector.s.y
        );
        const tT = new Vector3(
            texInfo.texture_vector.t.x,
            texInfo.texture_vector.t.z,
            -texInfo.texture_vector.t.y
        );
        for (let i = 0; i < vertices.length; i++) {
            const textureUVS =
                (vertices[i].dot(tS) + texInfo.texture_vector.s.w) /
                texData.view_width;
            const textureUVT =
                (vertices[i].dot(tT) + texInfo.texture_vector.t.w) /
                texData.view_height;

            UVs[i] = new Vector2(textureUVS, textureUVT);
        }
        return UVs;
    };

    private getFaces = (model: BSP.Types.Model): BSP.Types.Face[] => {
        const bsp = this.bsp;
        const faces = new Array<BSP.Types.Face>(model.face_length);
        for (
            let i = 0, j = model.face_offset;
            i < model.face_length;
            i++, j++
        ) {
            faces[i] = bsp.faces[j];
        }
        return faces;
    };

    private getVertices = (face: BSP.Types.Face): Vector3[] => {
        const vertices = new Array<Vector3>(face.surf_edge_length);
        for (
            let i = 0, j = face.surf_edge_offset;
            i < face.surf_edge_length;
            i++, j++
        ) {
            const bsp = this.bsp;
            const surf_edge = bsp.surfEdges[j]; // -reverse, +forward
            const edge = bsp.edges[Math.abs(surf_edge)];
            const vertex =
                surf_edge > 0 ? bsp.vertices[edge.p1] : bsp.vertices[edge.p2];
            vertices[i] = new Vector3(vertex.x, vertex.z, -vertex.y);
        }
        return vertices;
    };

    private getIndices = (
        face: BSP.Types.Face,
        offset: number = 0
    ): number[] => {
        const indices = new Array<number>((face.surf_edge_length - 2) * 3);
        for (let i = 0; i < face.surf_edge_length - 2; i++) {
            indices[0 + 3 * i] = 2 + offset + i;
            indices[1 + 3 * i] = 1 + offset + i;
            indices[2 + 3 * i] = 0 + offset;
        }
        return indices;
    };
}
