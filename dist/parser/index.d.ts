export interface VariableAssignment {
    name: string;
    operator: string;
    raw_value: string;
    line: number;
}
export interface ParseResult {
    ok: true;
    variables: VariableAssignment[];
    warnings?: string[];
}
export interface ErrorResult {
    ok: false;
    error_code: string;
    message: string;
}
export declare function parseRecipeFile(filePath: string): ParseResult | ErrorResult;
export declare function getRecipeVarRaw(filePath: string, variable: string): {
    ok: true;
    assignments: {
        operator: string;
        raw_value: string;
        line: number;
    }[];
} | ErrorResult;
export interface RecipeFileInfo {
    path: string;
    file_type: "bb" | "bbappend";
}
export declare function scanLayerRecipeFiles(layerPath: string): {
    ok: true;
    files: RecipeFileInfo[];
} | ErrorResult;
export interface RecipeMatchInfo {
    path: string;
    file_type: "bb" | "bbappend";
    filename: string;
}
export declare function findRecipeFiles(rootPath: string, query: string): {
    ok: true;
    matches: RecipeMatchInfo[];
} | ErrorResult;
//# sourceMappingURL=index.d.ts.map