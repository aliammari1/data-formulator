// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import '../scss/ConceptShelf.scss';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { Eraser, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

import { FieldItem, Channel } from '../components/ComponentType';

import React from 'react';
import { DataFormulatorState, dfActions } from '../app/dfSlice';
import { ConceptCard } from './ConceptCard';
import { Type } from '../data/types';
import { groupConceptItems } from './ViewUtils';
import { OperatorCard } from './OperatorCard';
import { cn } from '@/lib/utils';

export const genFreshCustomConcept : () => FieldItem = () => {
    return {
        id: `concept-${Date.now()}`, name: "", type: "auto" as Type,
        description: "", source: "custom", tableRef: "custom",
    }
}

export interface EncodingDropResult {
    channel: Channel
}

export interface ConceptShelfProps {
    
}

export const ConceptGroup: FC<{groupName: string, fields: FieldItem[]}> = function ConceptGroup({groupName, fields}) {

    const [expanded, setExpanded] = useState(true);
    const dispatch = useDispatch();
    const handleCleanUnusedConcepts = () => {
        dispatch(dfActions.clearUnReferencedCustomConcepts());
    };

    // Separate fields for display logic
    const displayFields = expanded ? fields : fields.slice(0, 6);
    const hasMoreFields = fields.length > 6;

    return (
        <div>
            <div className="block w-full">
                <div className="relative flex items-center w-full py-1">
                    <Separator className="flex-1" />
                    <div 
                        className="flex items-center cursor-pointer px-2"
                        onClick={() => setExpanded(!expanded)}
                    >
                        <h2 className={cn(
                            "text-[10px] flex items-center text-muted-foreground",
                            "hover:bg-black/5 rounded"
                        )}>
                            {groupName}
                            {fields.length > 6 && (
                                <span className={cn(
                                    "ml-0.5 rounded text-[10px] flex items-center text-muted-foreground",
                                    "transition-transform duration-300"
                                )}>
                                    {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                                </span>
                            )}
                        </h2>
                        {groupName === "new fields" && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCleanUnusedConcepts();
                                        }}
                                        className={cn(
                                            "h-4 w-4 min-w-0 px-0.5 py-0.5 ml-0",
                                            "hover:text-amber-500 hover:bg-amber-100/10",
                                            "[&:hover_.cleaning-icon]:animate-spin"
                                        )}
                                    >
                                        <Eraser className="cleaning-icon h-2.5 w-2.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>clean up unused fields</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    <Separator className="flex-1" />
                </div>
            </div>
            
            {/* Always show first 6 fields */}
            <div className="w-full">
                {displayFields.map((field) => (
                    <ConceptCard key={`concept-card-${field.id}`} field={field} />
                ))}
            </div>

            {/* Collapsible section for additional fields */}
            {hasMoreFields && !expanded && (
                <Button
                    variant="ghost"
                    onClick={() => setExpanded(true)}
                    className={cn(
                        "text-[10px] text-muted-foreground pl-4 py-1 h-auto",
                        "normal-case relative whitespace-nowrap w-full justify-start",
                        "hover:bg-transparent hover:underline",
                        "before:content-[''] before:absolute before:-top-5 before:left-0 before:right-0",
                        "before:h-5 before:bg-gradient-to-b before:from-transparent before:to-white",
                        "before:pointer-events-none"
                    )}
                >
                    {`... show all ${fields.length} ${groupName} fields ▾`}
                </Button>
            )}
        </div>
    );
}


export const ConceptShelf: FC<ConceptShelfProps> = function ConceptShelf() {

    const [conceptPanelOpen, setConceptPanelOpen] = useState(false);

    // reference to states
    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);
    const focusedTable = tables.find(t => t.id == focusedTableId);

    // group concepts based on types
    let conceptItemGroups = groupConceptItems(conceptShelfItems, tables);
    let groupNames = [...new Set(conceptItemGroups.map(g => g.group))]

    let conceptShelf = (
        <div 
            className={cn(
                "concept-shelf h-[calc(100%-16px)]",
                conceptPanelOpen ? "overflow-auto" : "overflow-hidden pointer-events-none"
            )}
        >
            <div className="my-0.5">
                <h2 className="view-title whitespace-nowrap">
                    Data Fields
                </h2>
            </div>
            <div className="data-fields-group">
                <div className="data-fields-list">
                    <div className="block w-full">
                        <div className="relative flex items-center w-full py-1">
                            <Separator className="flex-1" />
                            <span className="text-[10px] text-muted-foreground px-2">
                                field operators
                            </span>
                            <Separator className="flex-1" />
                        </div>
                    </div>
                    <div className="flex w-full flex-wrap">
                        <OperatorCard operator="count" />
                        <OperatorCard operator="sum" />
                        <OperatorCard operator="average" />
                        <OperatorCard operator="median" />
                        <OperatorCard operator="max" />
                        <OperatorCard operator="min" />
                    </div>
                    {groupNames.map(groupName => {
                        let fields = conceptItemGroups.filter(g => g.group == groupName).map(g => g.field);
                        fields = fields.sort((a, b) => {
                            if (focusedTable && focusedTable.names.includes(a.name) && !focusedTable.names.includes(b.name)) {
                                return -1;
                            } else if (focusedTable && !focusedTable.names.includes(a.name) && focusedTable.names.includes(b.name)) {
                                return 1;
                            } else {
                                return 0;
                            }
                        });
                        return <ConceptGroup key={`concept-group-${groupName}`} groupName={groupName} fields={fields} />
                    })}
                    <Separator className="mt-2" />
                </div>
            </div>
        </div>
    );

    return (
        <div className={cn(
            "flex flex-row shrink-0 overflow-hidden relative transition-[width] duration-100 ease-linear",
            conceptPanelOpen ? "w-60" : "w-8 border-l border-border pl-2"
        )}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "text-primary rounded-none shrink-0",
                            conceptPanelOpen 
                                ? "w-4 min-w-4 self-stretch relative bg-black/5" 
                                : "w-full min-w-full self-stretch absolute top-0 left-0 right-0 bottom-0 z-10"
                        )}
                        onClick={() => setConceptPanelOpen(!conceptPanelOpen)}
                    >
                        <div className="flex items-center justify-center z-10 mr-auto">
                            {conceptPanelOpen 
                                ? <ChevronRight className="h-[18px] w-[18px]" /> 
                                : <ChevronLeft className="h-9 w-9 bg-white rounded-full" />
                            }
                        </div>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                    {conceptPanelOpen ? "hide concept panel" : "open concept panel"}
                </TooltipContent>
            </Tooltip>
            <div 
                onClick={() => !conceptPanelOpen && setConceptPanelOpen(!conceptPanelOpen)}
                className={cn(
                    "overflow-hidden",
                    !conceptPanelOpen && "after:content-[''] after:absolute after:top-0 after:right-0 after:w-full after:h-full after:bg-white/95 after:pointer-events-none after:z-[1]"
                )}
            >
                {conceptShelf}
            </div>
        </div>
    );
}