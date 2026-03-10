export interface RecipeMetadata {
    name: string;
    version: string;
    description: string;
    license: string;
    srcUri: string[];
    depends: string[];
    rdepends: string[];
    inherit: string[];
    layerPath: string;
    filePath: string;
    variables: Record<string, string>;
}
export declare function parseRecipeFile(filePath: string): RecipeMetadata;
export declare function scanLayerForRecipes(layerPath: string): RecipeMetadata[];
//# sourceMappingURL=recipe.d.ts.map