// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from "react";
import ts from "typescript";
import { runCodeOnInputListsInVM } from "../app/utils";
import { ConceptTransformation, FieldItem } from "../components/ComponentType";
import { Type } from "../data/types";
import { BooleanIcon, NumericalIcon, StringIcon, DateIcon, UnknownIcon } from '../icons';

import { Sparkles, BarChart2, GitCommit } from 'lucide-react';

import { DictTable } from '../components/ComponentType';

export const groupConceptItems = (conceptShelfItems: FieldItem[], tables: DictTable[])  => {
    // group concepts based on which source table they belongs to
    return conceptShelfItems.map(f => {
        let group = ""
        if (f.source == "original") {
            group = tables.find(t => t.id == f.tableRef)?.displayId || f.tableRef;
        } else if (f.source == "custom") {
            group = "new fields"
        } else if (f.source == "derived") {
            group = tables.find(t => t.id == f.tableRef)?.displayId || f.tableRef;
        }
        return {group, field: f}
    });
}

// TODO: fix Unknown icon
export const getIconFromType = (t: Type | undefined): JSX.Element => {
    switch (t) {
        case Type.Boolean:
            return <BooleanIcon fontSize="inherit" />;
        case Type.Date:
            return <DateIcon fontSize="inherit" />;
        case Type.Integer:
        case Type.Number:
            return <NumericalIcon fontSize="inherit" />;
        case Type.String:
            return <StringIcon fontSize="inherit" />;
        case Type.Auto:
            return <Sparkles className="w-[1em] h-[1em]" />;
    }
    return <GitCommit className="w-[1em] h-[1em] opacity-30" />;
};

export const getIconFromDtype = (t: "quantitative" | "nominal" | "ordinal" | "temporal" | "auto"): JSX.Element => {
    switch (t) {
        case "quantitative":
            return <NumericalIcon fontSize="inherit" />;
        case "nominal":
            return <StringIcon fontSize="inherit" />;
        case "ordinal":
            return <BarChart2 className="w-[1em] h-[1em]" />;
        case "temporal":
            return <DateIcon fontSize="inherit" />;
        case "auto":
            return <Sparkles className="w-[1em] h-[1em]" />;
    }
    return <GitCommit className="w-[1em] h-[1em] opacity-30" />;
};