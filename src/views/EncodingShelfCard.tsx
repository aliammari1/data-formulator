// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { DataFormulatorState, dfActions, dfSelectors, fetchCodeExpl, fetchFieldSemanticType, generateFreshChart } from '../app/dfSlice';

import embed from 'vega-embed';

import React from 'react';
import { ThinkingBufferEffect } from '../components/FunComponents';
import { Channel, Chart, FieldItem, Trigger, duplicateChart } from "../components/ComponentType";

import _ from 'lodash';

import '../scss/EncodingShelf.scss';
import { createDictTable, DictTable } from "../components/ComponentType";

import { getUrls, resolveChartFields, getTriggers, assembleVegaChart, resolveRecommendedChart } from '../app/utils';
import { EncodingBox } from './EncodingBox';

import { ChannelGroups, CHART_TEMPLATES, getChartChannels, getChartTemplate } from '../components/ChartTemplates';
import { checkChartAvailability, getDataTable } from './VisualizationView';
import { ThinkingBanner } from './DataThread';

import { AppDispatch } from '../app/store';
import { Type } from '../data/types';
import { IdeaChip } from './ChartRecBox';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// lucide-react icons
import { Plus, X, Check, RefreshCw, Lightbulb, Bug, Factory, Table as TableIcon } from 'lucide-react';

// Property and state of an encoding shelf
export interface EncodingShelfCardProps { 
    chartId: string;
    trigger?: Trigger;
    noBorder?: boolean;
}

let selectBaseTables = (activeFields: FieldItem[], currentTable: DictTable, tables: DictTable[]) : DictTable[] => {
    
    let baseTables = [];

    // if the current table is derived from other tables, then we need to add those tables to the base tables
    if (currentTable.derive && !currentTable.anchored) {
        baseTables = currentTable.derive.source.map(t => tables.find(t2 => t2.id == t) as DictTable);
    } else {
        baseTables.push(currentTable);
    }

    // if there is no active fields at all!!
    if (activeFields.length == 0) {
        return baseTables;
    } else {
        // find what are other tables that was used to derive the active fields
        let relevantTableIds = [...new Set(activeFields.filter(t => t.source != "custom").map(t => t.tableRef))];
        // find all tables that contains the active original fields
        let tablesToAdd = tables.filter(t => relevantTableIds.includes(t.id));

        baseTables.push(...tablesToAdd.filter(t => !baseTables.map(t2 => t2.id).includes(t.id)));
    }

    return baseTables;
}

// Add this utility function before the TriggerCard component
export const renderTextWithEmphasis = (text: string, highlightClassName?: string) => {
    
    text = text.replace(/_/g, '_\u200B');
    // Split the prompt by ** patterns and create an array of text and highlighted segments
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            // This is a highlighted part - remove the ** and wrap with styled component
            const content = part.slice(2, -2).replaceAll('_', ' ');
            return (
                <span
                    key={index}
                    className={cn(
                        "text-inherit px-0.5 rounded",
                        highlightClassName
                    )}
                >
                    {content}
                </span>
            );
        }
        return part;
    });
};

export const TriggerCard: FC<{
    className?: string, 
    trigger: Trigger, 
    hideFields?: boolean, 
    mini?: boolean
}> = function ({ className, trigger, hideFields, mini = false }) {

    let fieldItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    const dispatch = useDispatch<AppDispatch>();

    let handleClick = () => {
        if (trigger.chart) {
            dispatch(dfActions.setFocusedChart(trigger.chart.id));
            dispatch(dfActions.setFocusedTable(trigger.chart.tableRef));
        }
    }

    let encodingComp : any = '';
    let encFields: string[] = [];

    if (trigger.chart) {

        let chart = trigger.chart;
        let encodingMap = chart?.encodingMap;

        encFields = Object.entries(encodingMap)
            .filter(([channel, encoding]) => {
                return encoding.fieldID != undefined;
            })
            .map(([channel, encoding], index) => {
                let field = fieldItems.find(f => f.id == encoding.fieldID) as FieldItem;
                return field.name;
            });

        encodingComp = Object.entries(encodingMap)
            .filter(([channel, encoding]) => {
                return encoding.fieldID != undefined;
            })
            .map(([channel, encoding], index) => {
                let field = fieldItems.find(f => f.id == encoding.fieldID) as FieldItem;
                return [index > 0 ? '⨉' : '', 
                        <Badge 
                            key={`trigger-${channel}-${field?.id}`}
                            variant="outline"
                            className="text-inherit max-w-[110px] m-0.5 h-[18px] text-xs rounded border border-[rgb(250,235,215)] bg-[rgb(250,235,215,0.7)] px-0.5"
                        >
                            {field?.name}
                        </Badge>]
            })
    }

    let prompt: string = trigger.displayInstruction;
    if (trigger.instruction == '' && encFields.length > 0) {
        prompt = '';
    } else if (!trigger.displayInstruction || (trigger.instruction != '' && trigger.instruction.length <= trigger.displayInstruction.replace(/\*\*/g, '').length)) {
        prompt = trigger.instruction;
    }

    // Process the prompt to highlight content in ** **
    const processedPrompt = renderTextWithEmphasis(prompt, cn(
        mini ? "text-[10px]" : "text-xs",
        "px-1 rounded bg-primary/10"
    ));

    if (mini) {
        return (
            <div 
                className={cn(
                    "ml-[7px] border-l-[3px] border-primary/50 pl-2",
                    "text-[10px] text-muted-foreground my-0.5 text-balance",
                    "hover:border-primary hover:cursor-pointer hover:text-foreground"
                )}
                onClick={handleClick}
            >
                {processedPrompt} 
                {hideFields ? "" : encodingComp}
            </div>
        );
    }

    return (
        <Card 
            className={cn(
                "cursor-pointer bg-primary/5",
                "text-xs flex flex-row items-center gap-0.5",
                "hover:-translate-y-px hover:shadow-md",
                className
            )} 
            onClick={handleClick}
        >
            <div className="mx-2 my-1">
                {hideFields ? "" : (
                    <div className="flex flex-wrap justify-center text-black/70">
                        {encodingComp}
                    </div>
                )}
                <p className="text-center w-fit min-w-[40px] text-black/70 text-xs">
                    {prompt.length > 0 && (
                        <Factory className="text-gray-400 w-3.5 h-3.5 mr-1 align-text-bottom inline-block" />
                    )}
                    {processedPrompt}
                </p>
            </div>
        </Card>
    );
}

// Add this component before EncodingShelfCard
const UserActionTableSelector: FC<{
    requiredActionTableIds: string[],
    userSelectedActionTableIds: string[],
    tables: DictTable[],
    updateUserSelectedActionTableIds: (tableIds: string[]) => void,
    requiredTableIds?: string[]
}> = ({ requiredActionTableIds, userSelectedActionTableIds, tables, updateUserSelectedActionTableIds, requiredTableIds = [] }) => {
    const [open, setOpen] = useState(false);

    let actionTableIds = [...requiredActionTableIds, ...userSelectedActionTableIds.filter(id => !requiredActionTableIds.includes(id))];

    const handleTableSelect = (table: DictTable) => {
        if (!actionTableIds.includes(table.id)) {
            updateUserSelectedActionTableIds([...userSelectedActionTableIds, table.id]);
        }
        setOpen(false);
    };

    return (
        <div className="flex flex-wrap gap-0.5 p-1 mb-1">
            {actionTableIds.map((tableId) => {
                const isRequired = requiredTableIds.includes(tableId);
                return (
                    <Badge
                        key={tableId}
                        variant="outline"
                        className={cn(
                            "h-4 text-[10px] rounded-none text-black/70 pl-1 pr-1.5",
                            isRequired ? "bg-blue-600/20" : "bg-blue-600/10"
                        )}
                    >
                        {tables.find(t => t.id == tableId)?.displayId}
                        {!isRequired && (
                            <button 
                                onClick={() => updateUserSelectedActionTableIds(actionTableIds.filter(id => id !== tableId))}
                                className="ml-1 hover:bg-black/10 rounded"
                            >
                                <X className="w-2 h-2" />
                            </button>
                        )}
                    </Badge>
                );
            })}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-4 h-4 p-0"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1">
                                {tables.map((table) => {
                                    const isSelected = !!actionTableIds.find(t => t === table.id);
                                    return (
                                        <button 
                                            key={table.id}
                                            disabled={isSelected}
                                            onClick={() => handleTableSelect(table)}
                                            className={cn(
                                                "w-full text-left text-xs px-2 py-1.5 rounded",
                                                "flex justify-between items-center",
                                                isSelected 
                                                    ? "opacity-50 cursor-not-allowed" 
                                                    : "hover:bg-accent cursor-pointer"
                                            )}
                                        >
                                            {table.displayId}
                                        </button>
                                    );
                                })}
                            </PopoverContent>
                        </Popover>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">add more base tables for data formulation</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};


export const EncodingShelfCard: FC<EncodingShelfCardProps> = function ({ chartId }) {
    // reference to states
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const config = useSelector((state: DataFormulatorState) => state.config);
    const agentRules = useSelector((state: DataFormulatorState) => state.agentRules);
    let existMultiplePossibleBaseTables = tables.filter(t => t.derive == undefined || t.anchored).length > 1;

    let activeModel = useSelector(dfSelectors.getActiveModel);
    let allCharts = useSelector(dfSelectors.getAllCharts);

    let chart = allCharts.find(c => c.id == chartId) as Chart;
    let trigger = chart.source == "trigger" ? tables.find(t => t.derive?.trigger?.chart?.id == chartId)?.derive?.trigger : undefined;

    let [ideateMode, setIdeateMode] = useState<boolean>(false);
    let [prompt, setPrompt] = useState<string>(trigger?.instruction || "");

    useEffect(() => {
        setPrompt(trigger?.instruction || "");
        if (!(chartState[chartId] && chartState[chartId].ideas.length > 0)) {
            setIdeateMode(false);
        }
    }, [chartId]);

    let encodingMap = chart?.encodingMap;

    const dispatch = useDispatch<AppDispatch>();

    const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState<boolean>(false);
    

    let handleUpdateChartType = (newChartType: string) => {
        dispatch(dfActions.updateChartType({chartId, chartType: newChartType}));
        // Close the menu after selection
        setChartTypeMenuOpen(false);
    }

    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    let currentTable = getDataTable(chart, tables, allCharts, conceptShelfItems);

    // Check if chart is available
    let isChartAvailable = checkChartAvailability(chart, conceptShelfItems, currentTable.rows);

    // Add this state
    const [userSelectedActionTableIds, setUserSelectedActionTableIds] = useState<string[]>([]);
    
    // Consolidated chart state - maps chartId to its ideas, thinkingBuffer, and loading state
    const [chartState, setChartState] = useState<Record<string, {
        ideas: {text: string, goal: string, difficulty: 'easy' | 'medium' | 'hard'}[],
        thinkingBuffer: string,
        isLoading: boolean
    }>>({});
    
    // Get current chart's state
    const currentState = chartState[chartId] || { ideas: [], thinkingBuffer: "", isLoading: false };
    const currentChartIdeas = currentState.ideas;
    const thinkingBuffer = currentState.thinkingBuffer;
    const isLoadingIdeas = currentState.isLoading;
    
    // Helper functions to update current chart's state
    const setIdeas = (ideas: {text: string, goal: string, difficulty: 'easy' | 'medium' | 'hard'}[]) => {
        setChartState(prev => ({
            ...prev,
            [chartId]: { ...prev[chartId] || { thinkingBuffer: "", isLoading: false }, ideas }
        }));
    };
    
    const setThinkingBuffer = (thinkingBuffer: string) => {
        setChartState(prev => ({
            ...prev,
            [chartId]: { ...prev[chartId] || { ideas: [], isLoading: false }, thinkingBuffer }
        }));
    };
    
    const setIsLoadingIdeas = (isLoading: boolean) => {
        setChartState(prev => ({
            ...prev,
            [chartId]: { ...prev[chartId] || { ideas: [], thinkingBuffer: "" }, isLoading }
        }));
    };
    
    // Add state for developer message dialog
    const [devMessageOpen, setDevMessageOpen] = useState<boolean>(false);
    
    // Update the handler to use state
    const handleUserSelectedActionTableChange = (newTableIds: string[]) => {
        setUserSelectedActionTableIds(newTableIds);
    };

    let encodingBoxGroups = Object.entries(ChannelGroups)
        .filter(([group, channelList]) => channelList.some(ch => Object.keys(encodingMap).includes(ch)))
        .map(([group, channelList]) => {

            let component = <div key={`encoding-group-box-${group}`}>
                <p key={`encoding-group-${group}`} className="text-[10px] text-muted-foreground mt-1.5 mb-0.5">{group}</p>
                {channelList.filter(channel => Object.keys(encodingMap).includes(channel))
                    .map(channel => <EncodingBox key={`shelf-${channel}`} channel={channel as Channel} chartId={chartId} tableId={currentTable.id} />)}
            </div>
            return component;
        });

    // derive active fields from encoding map so that we can keep the order of which fields will be visualized
    let activeFields = Object.values(encodingMap).map(enc => enc.fieldID).filter(fieldId => fieldId && conceptShelfItems.map(f => f.id)
                                .includes(fieldId)).map(fieldId => conceptShelfItems.find(f => f.id == fieldId) as FieldItem);
    let activeSimpleEncodings: { [key: string]: string } = {};
    for (let channel of getChartChannels(chart.chartType)) {
        if (chart.encodingMap[channel as Channel]?.fieldID) {
            activeSimpleEncodings[channel] = activeFields.find(f => f.id == chart.encodingMap[channel as Channel].fieldID)?.name as string;
        }
    }
    
    let activeCustomFields = activeFields.filter(field => field.source == "custom");

    // check if the current table contains all fields already exists a table that fullfills the user's specification
    let existsWorkingTable = activeFields.length == 0 || activeFields.every(f => currentTable.names.includes(f.name));
    
    // this is the base tables that will be used to derive the new data
    // this is the bare minimum tables that are required to derive the new data, based fields that will be used
    let requiredActionTables = selectBaseTables(activeFields, currentTable, tables);
    let actionTableIds = [
        ...requiredActionTables.map(t => t.id),
        ...userSelectedActionTableIds.filter(id => !requiredActionTables.map(t => t.id).includes(id))
    ];

    let getIdeasForVisualization = async () => {
        if (!currentTable || isLoadingIdeas) {
            return;
        }

        setIsLoadingIdeas(true);
        setThinkingBuffer("");
        setIdeas([]);

        try {
            // Build exploration thread from current table to root
            let explorationThread: any[] = [];
            
            // If current table is derived, build the exploration thread
            if (currentTable.derive && !currentTable.anchored) {
                let triggers = getTriggers(currentTable, tables);
                
                // Build exploration thread with all derived tables in the chain
                explorationThread = triggers
                    .map(trigger => ({
                        name: trigger.resultTableId,
                        rows: tables.find(t2 => t2.id === trigger.resultTableId)?.rows,
                        description: `Derive from ${trigger.sourceTableIds} with instruction: ${trigger.instruction}`,
                    }));
            }

            // Get the root table (first table in actionTableIds)
            const rootTable = tables.find(t => t.id === actionTableIds[0]);
            if (!rootTable) {
                throw new Error('No root table found');
            }

            let chartAvailable = checkChartAvailability(chart, conceptShelfItems, currentTable.rows);
            let currentChartPng = chartAvailable ? await vegaLiteSpecToPng(assembleVegaChart(chart.chartType, chart.encodingMap, activeFields, currentTable.rows, currentTable.metadata, 20)) : undefined;

            const token = String(Date.now());
            const messageBody = JSON.stringify({
                token: token,
                model: activeModel,
                input_tables: [{
                    name: rootTable.virtual?.tableId || rootTable.id.replace(/\.[^/.]+$/, ""),
                    rows: rootTable.rows,
                    attached_metadata: rootTable.attachedMetadata
                }],
                language: currentTable.virtual ? "sql" : "python",
                exploration_thread: explorationThread,
                current_data_sample: currentTable.rows.slice(0, 10),
                current_chart: currentChartPng,
                mode: 'interactive',
                agent_exploration_rules: agentRules.exploration
            });

            const engine = getUrls().GET_RECOMMENDATION_QUESTIONS;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(engine, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: messageBody,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Use streaming reader instead of response.json()
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();

            let lines: string[] = [];
            let buffer = '';

            let updateState = (lines: string[]) => {

                let dataBlocks = lines
                    .map(line => {
                        try { return JSON.parse(line.trim()); } catch (e) { return null; }})
                    .filter(block => block != null);

                let questions = dataBlocks.filter(block => block.type == "question").map(block => ({
                    text: block.text,
                    goal: block.goal,
                    difficulty: block.difficulty,
                    tag: block.tag
                }));

                setIdeas(questions);
            }

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) { break; }

                    buffer += decoder.decode(value, { stream: true });
                    let newLines = buffer.split('data: ').filter(line => line.trim() !== "");

                    buffer = newLines.pop() || '';
                    if (newLines.length > 0) {
                        lines.push(...newLines);
                        updateState(lines);
                    }
                    setThinkingBuffer(buffer.replace(/^data: /, ""));
                }
            } finally {
                reader.releaseLock();
            }

            lines.push(buffer);
            updateState(lines);

            // Process the final result
            if (lines.length == 0) {
                throw new Error('No valid results returned from agent');
            }
        } catch (error) {
            dispatch(dfActions.addMessages({
                "timestamp": Date.now(),
                "type": "error",
                "component": "encoding shelf",
                "value": "Failed to get ideas from the exploration agent. Please try again.",
                "detail": error instanceof Error ? error.message : 'Unknown error'
            }));
        } finally {
            setIsLoadingIdeas(false);
        }
    }   

    // Function to handle idea chip click
    const handleIdeaClick = (ideaText: string) => {
        setIdeateMode(true);
        setPrompt(ideaText);
        // Automatically start the data formulation process
        deriveNewData(ideaText, 'ideate');
    };


    let deriveNewData = (
        instruction: string, 
        mode: 'formulate' | 'ideate' = 'formulate', 
        overrideTableId?: string,
    ) => {

        if (actionTableIds.length == 0) {
            return;
        }

        let actionTables = actionTableIds.map(id => tables.find(t => t.id == id) as DictTable);

        if (currentTable.derive == undefined && instruction == "" && 
                (activeFields.length > 0 && activeCustomFields.length == 0) && 
                tables.some(t => t.derive == undefined && 
                activeFields.every(f => currentTable.names.includes(f.name)))) {

            // if there is no additional fields, directly generate
            let tempTable = getDataTable(chart, tables, allCharts, conceptShelfItems, true);
            dispatch(dfActions.updateTableRef({chartId: chartId, tableRef: tempTable.id}))

            //dispatch(dfActions.resetDerivedTables([])); //([{code: "", data: inputData.rows}]));
            dispatch(dfActions.changeChartRunningStatus({chartId, status: true}));
            // a fake function to give the feel that synthesizer is running
            setTimeout(function(){
                dispatch(dfActions.changeChartRunningStatus({chartId, status: false}));
                dispatch(dfActions.clearUnReferencedTables());
            }, 400);
            return
        }

        dispatch(dfActions.clearUnReferencedTables());
        
        let fieldNamesStr = activeFields.map(f => f.name).reduce(
            (a: string, b: string, i, array) => a + (i == 0 ? "" : (i < array.length - 1 ? ', ' : ' and ')) + b, "")

        let chartType = chart.chartType;

        let token = String(Date.now());

        // if nothing is specified, just a formulation from the beginning
        let messageBody = JSON.stringify({
            token: token,
            mode,
            input_tables: actionTables.map(t => {
                return { 
                    name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/ , ""), 
                    rows: t.rows, 
                    attached_metadata: t.attachedMetadata 
                }}),
            chart_type: chartType,
            chart_encodings: mode == 'formulate' ? activeSimpleEncodings : {},
            extra_prompt: instruction,
            model: activeModel,
            max_repair_attempts: config.maxRepairAttempts,
            agent_coding_rules: agentRules.coding,
            language: actionTables.some(t => t.virtual) ? "sql" : "python"
        })

        let engine = getUrls().DERIVE_DATA;

        if (currentTable.derive?.dialog && !currentTable.anchored) {
            let sourceTableIds = currentTable.derive?.source;

            let startNewDialog = (!sourceTableIds.every(id => actionTableIds.includes(id)) || 
                !actionTableIds.every(id => sourceTableIds.includes(id))) || mode === 'ideate';

            // Compare if source and base table IDs are different
            if (startNewDialog) {

                console.log("start new dialog", startNewDialog);
                
                let additionalMessages = currentTable.derive.dialog;

                // in this case, because table ids has changed, we need to use the additional messages and reformulate
                messageBody = JSON.stringify({
                    token: token,
                    mode,
                    input_tables: actionTables.map(t => {
                        return { 
                            name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/ , ""), 
                            rows: t.rows, 
                            attached_metadata: t.attachedMetadata 
                        }}),
                    chart_type: chartType,
                    chart_encodings: mode == 'formulate' ? activeSimpleEncodings : {},
                    extra_prompt: instruction,
                    model: activeModel,
                    additional_messages: additionalMessages,
                    max_repair_attempts: config.maxRepairAttempts,
                    agent_coding_rules: agentRules.coding,
                    language: actionTables.some(t => t.virtual) ? "sql" : "python"
                });
                engine = getUrls().DERIVE_DATA;
            } else {
                messageBody = JSON.stringify({
                    token: token,
                    mode,
                    input_tables: actionTables.map(t => {
                        return { 
                            name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/ , ""), 
                            rows: t.rows, 
                            attached_metadata: t.attachedMetadata 
                        }}),
                    chart_type: chartType,
                    chart_encodings: mode == 'formulate' ? activeSimpleEncodings : {},
                    dialog: currentTable.derive?.dialog,
                    latest_data_sample: currentTable.rows.slice(0, 10),
                    new_instruction: instruction,
                    model: activeModel,
                    max_repair_attempts: config.maxRepairAttempts,
                    agent_coding_rules: agentRules.coding,
                    language: actionTables.some(t => t.virtual) ? "sql" : "python"
                })
                engine = getUrls().REFINE_DATA;
            } 
        }

        let message = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: messageBody,
        };

        dispatch(dfActions.changeChartRunningStatus({chartId, status: true}));

        // timeout the request after 30 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.formulateTimeoutSeconds * 1000);
    
        fetch(engine, {...message, signal: controller.signal })
            .then((response: Response) => response.json())
            .then((data) => {
                
                dispatch(dfActions.changeChartRunningStatus({chartId, status: false}))

                if (data.results.length > 0) {
                    if (data["token"] == token) {
                        let candidates = data["results"].filter((item: any) => {
                            return item["status"] == "ok"  
                        });

                        if (candidates.length == 0) {
                            let errorMessage = data.results[0].content;
                            let code = data.results[0].code;

                            dispatch(dfActions.addMessages({
                                "timestamp": Date.now(),
                                "type": "error",
                                "component": "chart builder",
                                "value": `Data formulation failed, please try again.`,
                                "code": code,
                                "detail": errorMessage
                            }));
                        } else {

                            let candidate = candidates[0];
                            let code = candidate["code"];
                            let rows = candidate["content"]["rows"];
                            let dialog = candidate["dialog"];
                            let refinedGoal = candidate['refined_goal']
                            let displayInstruction = refinedGoal["display_instruction"];

                            // determine the table id for the new table
                            let candidateTableId;
                            if (overrideTableId) {
                                candidateTableId = overrideTableId;
                            } else {
                                if (candidate["content"]["virtual"] != null) {
                                    candidateTableId = candidate["content"]["virtual"]["table_name"];
                                } else {
                                    let genTableId = () => {
                                        let tableSuffix = Number.parseInt((Date.now() - Math.floor(Math.random() * 10000)).toString().slice(-2));
                                        let tableId = `table-${tableSuffix}`
                                        while (tables.find(t => t.id == tableId) != undefined) {
                                            tableSuffix = tableSuffix + 1;
                                            tableId = `table-${tableSuffix}`
                                        }
                                        return tableId;
                                    }
                                    candidateTableId = genTableId();
                                }
                            }

                            // PART 1: handle triggers
                            // add the intermediate chart that will be referred by triggers

                            let triggerChartSpec = duplicateChart(chart);
                            triggerChartSpec.source = "trigger";

                            let currentTrigger: Trigger =  { 
                                tableId: currentTable.id, 
                                sourceTableIds: actionTableIds,
                                instruction: instruction, 
                                displayInstruction: displayInstruction,
                                chart: triggerChartSpec,
                                resultTableId: candidateTableId
                            }
                        
                            // PART 2: create new table (or override table)
                            let candidateTable = createDictTable(
                                candidateTableId, 
                                rows, 
                                { 
                                    code: code, 
                                    source: actionTableIds, 
                                    dialog: dialog, 
                                    trigger: currentTrigger 
                                }
                            )
                            if (candidate["content"]["virtual"] != null) {
                                candidateTable.virtual = {
                                    tableId: candidate["content"]["virtual"]["table_name"],
                                    rowCount: candidate["content"]["virtual"]["row_count"]
                                };
                            }

                            if (overrideTableId) {
                                dispatch(dfActions.overrideDerivedTables(candidateTable));
                            } else {
                                dispatch(dfActions.insertDerivedTables(candidateTable));
                            }
                            let names = candidateTable.names;
                            let missingNames = names.filter(name => !conceptShelfItems.some(field => field.name == name));
                
                            let conceptsToAdd = missingNames.map((name) => {
                                return {
                                    id: `concept-${name}-${Date.now()}`, 
                                    name: name, 
                                    type: "auto" as Type, 
                                    description: "", 
                                    source: "custom", 
                                    tableRef: "custom", 
                                    temporary: true, 
                                } as FieldItem
                            })
                            dispatch(dfActions.addConceptItems(conceptsToAdd));

                            dispatch(fetchFieldSemanticType(candidateTable));
                            dispatch(fetchCodeExpl(candidateTable));

                            // concepts from the current table
                            let currentConcepts = [...conceptShelfItems.filter(c => names.includes(c.name)), ...conceptsToAdd];

                            // PART 3: create new charts if necessary
                            let needToCreateNewChart = true;
                            
                            // different override strategy -- only override if there exists a chart that share the exact same encoding fields as the planned new chart.
                            if (mode != "ideate" && chart.chartType != "Auto" &&  overrideTableId != undefined && allCharts.filter(c => c.source == "user").find(c => c.tableRef == overrideTableId)) {
                                let chartsFromOverrideTable = allCharts.filter(c => c.source == "user" && c.tableRef == overrideTableId);
                                let chartsWithSameEncoding = chartsFromOverrideTable.filter(c => {
                                    let getSimpliedChartEnc = (chart: Chart) => {
                                        return chart.chartType + ":" + Object.entries(chart.encodingMap).filter(([channel, enc]) => enc.fieldID != undefined).map(([channel, enc]) => {
                                            return `${channel}:${enc.fieldID}:${enc.aggregate}:${enc.stack}:${enc.sortOrder}:${enc.sortBy}:${enc.scheme}`;
                                        }).join(";");
                                    }
                                    return getSimpliedChartEnc(c) == getSimpliedChartEnc(triggerChartSpec);
                                });
                                if (chartsWithSameEncoding.length > 0) {
                                    // find the chart to set as focus
                                    dispatch(dfActions.setFocusedChart(chartsWithSameEncoding[0].id));
                                    needToCreateNewChart = false;
                                }
                            }
                            
                            if (needToCreateNewChart) {
                                let newChart : Chart; 
                                if (mode == "ideate" || chart.chartType == "Auto") {
                                    newChart = resolveRecommendedChart(refinedGoal, currentConcepts, candidateTable);

                                } else if (chart.chartType == "Table") {
                                    newChart = generateFreshChart(candidateTable.id, 'Table')
                                } else {
                                    newChart = structuredClone(chart) as Chart;
                                    newChart.source = "user";
                                    newChart.id = `chart-${Date.now()- Math.floor(Math.random() * 10000)}`;
                                    newChart.saved = false;
                                    newChart.tableRef = candidateTable.id;
                                    newChart = resolveChartFields(newChart, currentConcepts, refinedGoal['chart_encodings'], candidateTable);
                                }   
                                
                                dispatch(dfActions.addAndFocusChart(newChart));
                            }

                            // PART 4: clean up
                            if (chart.chartType == "Table" || chart.chartType == "Auto" || (existsWorkingTable == false)) {
                                dispatch(dfActions.deleteChartById(chartId));
                            }
                            dispatch(dfActions.clearUnReferencedTables());
                            dispatch(dfActions.clearUnReferencedCustomConcepts());
                            dispatch(dfActions.setFocusedTable(candidateTable.id));

                            dispatch(dfActions.addMessages({
                                "timestamp": Date.now(),
                                "component": "chart builder",
                                "type": "success",
                                "value": `Data formulation for ${fieldNamesStr} succeeded.`
                            }));
                        }
                    }
                } else {
                    // TODO: add warnings to show the user
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "component": "chart builder",
                        "type": "error",
                        "value": "No result is returned from the data formulation agent. Please try again."
                    }));
                }
            }).catch((error) => {
                dispatch(dfActions.changeChartRunningStatus({chartId, status: false}));
                // Check if the error was caused by the AbortController
                if (error.name === 'AbortError') {
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "component": "chart builder",
                        "type": "error",
                        "value": `Data formulation timed out after ${config.formulateTimeoutSeconds} seconds. Consider breaking down the task, using a different model or prompt, or increasing the timeout limit.`,
                        "detail": "Request exceeded timeout limit"
                    }));
                } else {
                    console.error(error);
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "component": "chart builder",
                        "type": "error",
                        "value": `Data formulation failed, please try again.`,
                        "detail": error.message
                    }));
                }
            });
    }


    // zip multiple components together
    const w: any = (a: any[], b: any[]) => a.length ? [a[0], ...w(b, a.slice(1))] : b;

    let formulateInputBox = (
        <div key='text-input-boxes' className="flex flex-row flex-1 px-1">
            <Textarea
                id="outlined-multiline-flexible"
                className="text-xs min-h-[24px] resize-none border-0 border-b focus-visible:ring-0 rounded-none"
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setPrompt(event.target.value);
                }}
                onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (prompt.trim().length > 0) {
                            deriveNewData(prompt, 'formulate');
                        }
                    }
                }}
                value={prompt}
                placeholder={['Auto'].includes(chart.chartType) 
                    ? (isChartAvailable ? "what do you want to visualize?" : " ✏️ what do you want to visualize?")
                    : (isChartAvailable ? "formulate data" : " ✏️  formulate data")}
                rows={1}
            />
            {trigger ? (
                <div className="flex">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-0 text-amber-600 hover:text-amber-700"
                                    onClick={() => { 
                                        deriveNewData(trigger.instruction, 'formulate', trigger.resultTableId); 
                                    }}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-[11px]">formulate and override <TableIcon className="w-2.5 h-2.5 inline -mb-px" />{trigger.resultTableId}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            ) : (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="ml-0 text-primary"
                                onClick={() => { deriveNewData(prompt, 'formulate'); }}
                            >
                                <Factory className={cn(
                                    "w-5 h-5",
                                    !isChartAvailable && "animate-pulse"
                                )} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Formulate</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );

    // Ideas display section - get ideas for current chart
    let ideasSection = currentChartIdeas.length > 0 ? (
        <div key='ideas-section'>
            <div className="p-1 flex flex-wrap gap-1.5">
                {currentChartIdeas.map((idea, index) => (
                    <IdeaChip
                        mini={true}
                        key={index}
                        idea={idea}
                        onClick={() => handleIdeaClick(idea.text)}
                    />
                ))}
                {isLoadingIdeas && thinkingBuffer && <ThinkingBufferEffect text={thinkingBuffer.slice(-40)} className="w-full" />}
            </div>
        </div>
    ) : null;

    // Mode toggle header component
    const ModeToggleHeader = () => (
        <div className="flex items-center gap-2 px-2 py-1 border-b border-black/[0.08] bg-black/[0.02]">
            <span 
                className={cn(
                    "flex items-center gap-1 text-[11px] cursor-pointer px-1.5 py-0.5 rounded",
                    "transition-all duration-200",
                    ideateMode 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:bg-black/[0.04]"
                )}
                onClick={() => {
                    if (currentChartIdeas.length > 0) {
                        setIdeateMode(true);
                        setPrompt("");
                    } else {
                        setIdeateMode(true);
                        getIdeasForVisualization();
                    }
                }}
            >
                {currentChartIdeas.length > 0 ? "Ideas" : "Get Ideas"}
                <Lightbulb className="w-3 h-3 animate-pulse" />
            </span>
            <span 
                className={cn(
                    "text-[11px] cursor-pointer px-1.5 py-0.5 rounded",
                    "transition-all duration-200",
                    !ideateMode 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:bg-black/[0.04]"
                )}
                onClick={() => setIdeateMode(false)}
            >
                Editor
            </span>
            <div className="flex-1" />
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setDevMessageOpen(true)}
                className="w-5 h-5"
            >
                <Bug className="w-2.5 h-2.5" />
            </Button>
        </div>
    );

    let channelComponent = (
        <div className="w-full min-w-[210px] h-full flex flex-col">
            {existMultiplePossibleBaseTables && <UserActionTableSelector 
                requiredActionTableIds={requiredActionTables.map(t => t.id)}
                userSelectedActionTableIds={userSelectedActionTableIds}
                tables={tables.filter(t => t.derive === undefined || t.anchored)}
                updateUserSelectedActionTableIds={handleUserSelectedActionTableChange}
                requiredTableIds={requiredActionTables.map(t => t.id)}
            />}
            <div key='mark-selector-box' className="flex-none">
                <Select
                    value={chart.chartType}
                    onValueChange={(value) => handleUpdateChartType(value)}
                >
                    <SelectTrigger className="w-full text-xs h-8">
                        <SelectValue>
                            {(() => {
                                const t = getChartTemplate(chart.chartType);
                                return (
                                    <div className="flex items-center px-1">
                                        <div className="min-w-[24px]">
                                            {typeof t?.icon == 'string' ? 
                                                <img height="24px" width="24px" src={t?.icon} alt="" role="presentation" /> : 
                                                <div className="w-6 h-6">{t?.icon}</div>
                                            }
                                        </div>
                                        <span className="ml-0.5 text-xs whitespace-normal">{t?.chart}</span>
                                    </div>
                                );
                            })()}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                        {Object.entries(CHART_TEMPLATES).map(([group, templates]) => (
                            <SelectGroup key={group}>
                                <SelectLabel className="text-muted-foreground text-xs">{group}</SelectLabel>
                                {templates.map((t, i) => (
                                    <SelectItem 
                                        key={`${group}-${i}`}
                                        value={t.chart}
                                        className="text-xs pl-2 pr-2 min-h-[32px] my-px"
                                    >
                                        <div className="flex items-center">
                                            <div className="min-w-[20px]">
                                                {typeof t?.icon == 'string' ? 
                                                    <img height="20px" width="20px" src={t?.icon} alt="" role="presentation" /> : 
                                                    <div className="w-5 h-5">{t?.icon}</div>
                                                }
                                            </div>
                                            <span className="text-[11px] m-0">{t.chart}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div key='encoding-groups' className="flex-1 h-[calc(100%-100px)] encoding-list">
                {encodingBoxGroups}
            </div>
            {formulateInputBox}
        </div>
    );

    const encodingShelfCard = (
        <>
            <Card className={cn(
                "p-0 max-w-[400px] flex flex-col border",
                trigger && "bg-[rgba(255,160,122,0.07)]"
            )}>
                <ModeToggleHeader />
                {ideateMode ? (
                    <div className="p-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost"
                                        disabled={isLoadingIdeas} 
                                        size="sm"
                                        onClick={() => { getIdeasForVisualization(); }}
                                        className="text-xs normal-case"
                                    >
                                        {isLoadingIdeas ? (
                                            ThinkingBanner('ideating...')
                                        ) : (
                                            <>
                                                <Lightbulb className="w-2.5 h-2.5 mr-1" />
                                                {currentChartIdeas.length > 0 ? "Different ideas?" : "Get Ideas?"}
                                            </>
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>get ideas for visualization</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {ideasSection}
                    </div>
                ) : (
                    <div className="p-2">
                        {channelComponent}
                    </div>
                )}
            </Card>
            <Dialog open={devMessageOpen} onOpenChange={setDevMessageOpen}>
                <DialogContent className="sm:max-w-md rounded-lg shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="pb-1 font-semibold text-xl text-primary">
                            👋 Hello from the developers!
                        </DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="mb-4">
                        How did you find this? We're glad you're exploring!
                        <br />
                        Drop us a message at{' '}
                        <a
                            href="https://github.com/microsoft/data-formulator"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium no-underline hover:underline"
                        >
                            github.com/microsoft/data-formulator
                        </a>
                        {' '}if you have any questions or feedback.
                    </DialogDescription>
                    <DialogFooter className="px-3 pb-2">
                        <Button 
                            onClick={() => setDevMessageOpen(false)}
                            className="normal-case rounded-md"
                        >
                            Got it!
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );

    return encodingShelfCard;
}

// Function to convert Vega-Lite spec to PNG data URL with improved resolution
const vegaLiteSpecToPng = async (spec: any, scale: number = 2.0, quality: number = 1.0): Promise<string | null> => {
    try {
        // Create a temporary container
        const tempId = `temp-chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempContainer = document.createElement('div');
        tempContainer.id = tempId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);

        // Embed the chart with higher resolution settings
        const result = await embed('#' + tempId, spec, { 
            actions: false, 
            renderer: "canvas",
            scaleFactor: scale // Apply scale factor for higher resolution
        });

        // Get the canvas and apply high-resolution rendering
        const canvas = await result.view.toCanvas(scale); // Pass scale to toCanvas
        const pngDataUrl = canvas.toDataURL('image/png', quality);

        // Clean up
        document.body.removeChild(tempContainer);

        return pngDataUrl;
    } catch (error) {
        console.error('Error converting Vega-Lite spec to PNG:', error);
        return null;
    }
};

// Alternative method using toImageURL for even better quality
const vegaLiteSpecToPngWithImageURL = async (spec: any, scale: number = 2.0): Promise<string | null> => {
    try {
        // Create a temporary container
        const tempId = `temp-chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempContainer = document.createElement('div');
        tempContainer.id = tempId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);

        // Embed the chart
        const result = await embed('#' + tempId, spec, { 
            actions: false, 
            renderer: "canvas",
            scaleFactor: scale
        });

        // Use toImageURL for better quality
        const pngDataUrl = await result.view.toImageURL('png', scale);

        // Clean up
        document.body.removeChild(tempContainer);

        return pngDataUrl;
    } catch (error) {
        console.error('Error converting Vega-Lite spec to PNG:', error);
        return null;
    }
};
