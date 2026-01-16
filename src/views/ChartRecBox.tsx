// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { DataFormulatorState, dfActions, dfSelectors, fetchCodeExpl, fetchFieldSemanticType, generateFreshChart } from '../app/dfSlice';

import { AppDispatch } from '../app/store';

import React from 'react';

import { Chart, FieldItem } from "../components/ComponentType";

import _ from 'lodash';

import '../scss/EncodingShelf.scss';
import { createDictTable, DictTable } from "../components/ComponentType";

import { getUrls, getTriggers, resolveRecommendedChart } from '../app/utils';

import { Plus, X, Lightbulb, TrendingUp, Cog, Loader2 } from 'lucide-react';
import { Type } from '../data/types';
import { renderTextWithEmphasis } from './EncodingShelfCard';
import { ThinkingBufferEffect } from '../components/FunComponents';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

// when this is set to true, the new chart will be focused automatically
const AUTO_FOCUS_NEW_CHART = false;

// Color configuration for modes
const modeColors = {
    agent: {
        base: 'rgb(99, 102, 241)', // indigo-500
        light: 'rgba(99, 102, 241, 0.1)',
        medium: 'rgba(99, 102, 241, 0.2)',
        hover: 'rgba(99, 102, 241, 0.08)',
    },
    interactive: {
        base: 'rgb(236, 72, 153)', // pink-500
        light: 'rgba(236, 72, 153, 0.1)',
        medium: 'rgba(236, 72, 153, 0.2)',
        hover: 'rgba(236, 72, 153, 0.08)',
    }
};

// Difficulty color helpers
const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy':
            return { base: 'rgb(34, 197, 94)', light: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.4)' };
        case 'medium':
            return { base: 'rgb(99, 102, 241)', light: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.4)' };
        case 'hard':
            return { base: 'rgb(245, 158, 11)', light: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.4)' };
        default:
            return { base: 'rgb(107, 114, 128)', light: 'rgba(107, 114, 128, 0.1)', border: 'rgba(107, 114, 128, 0.4)' };
    }
};

export interface ChartRecBoxProps {
    tableId: string;
    placeHolderChartId?: string;
    className?: string;
}

// Table selector component for ChartRecBox
const NLTableSelector: FC<{
    selectedTableIds: string[],
    tables: DictTable[],
    updateSelectedTableIds: (tableIds: string[]) => void,
    requiredTableIds?: string[]
}> = ({ selectedTableIds, tables, updateSelectedTableIds, requiredTableIds = [] }) => {
    const [open, setOpen] = useState(false);

    const handleTableSelect = (table: DictTable) => {
        if (!selectedTableIds.includes(table.id)) {
            updateSelectedTableIds([...selectedTableIds, table.id]);
        }
        setOpen(false);
    };

    return (
        <div className="flex flex-wrap gap-0.5 p-1 mb-0.5">
            {selectedTableIds.map((tableId) => {
                const isRequired = requiredTableIds.includes(tableId);
                return (
                    <Badge
                        key={tableId}
                        variant="secondary"
                        className={cn(
                            "h-4 text-[10px] rounded-sm px-1",
                            isRequired ? "bg-blue-500/20" : "bg-blue-500/10",
                            "text-foreground/70"
                        )}
                    >
                        {tables.find(t => t.id == tableId)?.displayId}
                        {!isRequired && (
                            <button
                                onClick={() => updateSelectedTableIds(selectedTableIds.filter(id => id !== tableId))}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="w-2 h-2" />
                            </button>
                        )}
                    </Badge>
                );
            })}
            <Popover open={open} onOpenChange={setOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-4 h-4 p-0"
                                >
                                    <Plus className="w-2.5 h-2.5" />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Select tables for data formulation</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <PopoverContent className="w-48 p-1">
                    {tables
                        .filter(t => t.derive === undefined || t.anchored)
                        .map((table) => {
                            const isSelected = selectedTableIds.includes(table.id);
                            const isRequired = requiredTableIds.includes(table.id);
                            return (
                                <button 
                                    disabled={isSelected}
                                    key={table.id}
                                    onClick={() => handleTableSelect(table)}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 text-xs flex justify-between items-center rounded hover:bg-accent",
                                        isSelected && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {table.displayId}
                                    {isRequired && <span className="text-[10px] text-muted-foreground">(required)</span>}
                                </button>
                            );
                        })
                    }
                </PopoverContent>
            </Popover>
        </div>
    );
};



export const IdeaChip: FC<{
    mini?: boolean,
    idea: {text?: string, questions?: string[], goal: string, difficulty: 'easy' | 'medium' | 'hard', type?: 'branch' | 'deep_dive'} 
    onClick: () => void, 
    className?: string,
    disabled?: boolean,
}> = function ({mini, idea, onClick, className, disabled}) {

    const colors = getDifficultyColor(idea.difficulty || 'medium');
    const ideaText = idea.goal;

    const ideaTextComponent = renderTextWithEmphasis(ideaText, {
        borderRadius: '0px',
        borderBottom: `1px solid`,
        borderColor: colors.border,
        fontSize: '11px',
        lineHeight: 1.4,
        backgroundColor: colors.light,
    });

    return (
        <div
            className={cn(
                "inline-flex items-center px-1.5 py-1 text-[11px] min-h-[24px] h-auto rounded-lg",
                "border transition-all duration-100 bg-background/90",
                disabled ? "cursor-default opacity-60" : "cursor-pointer hover:-translate-y-0.5",
                className
            )}
            style={{
                borderColor: colors.border,
            }}
            onClick={disabled ? undefined : onClick}
        >
            <div className="text-[11px]" style={{ color: colors.base }}>
                {ideaTextComponent}
            </div>
        </div>
    );
};

export const AgentIdeaChip: FC<{
    mini?: boolean,
    idea: {questions: string[], goal: string, difficulty: 'easy' | 'medium' | 'hard'} 
    onClick: () => void, 
    className?: string,
    disabled?: boolean,
}> = function ({mini, idea, onClick, className, disabled}) {

    const colors = getDifficultyColor(idea.difficulty || 'medium');
    const ideaText = idea.goal;

    const ideaTextComponent = renderTextWithEmphasis(ideaText, {
        borderRadius: '0px',
        borderBottom: `1px solid`,
        borderColor: colors.border,
        fontSize: '11px',
        lineHeight: 1.4,
        backgroundColor: colors.light,
    });

    return (
        <div
            className={cn(
                "inline-flex items-center px-1.5 py-1 text-[11px] min-h-[24px] h-auto rounded-lg",
                "border transition-all duration-100 bg-background/90",
                disabled ? "cursor-default opacity-60" : "cursor-pointer hover:-translate-y-0.5",
                className
            )}
            style={{
                borderColor: colors.border,
            }}
            onClick={disabled ? undefined : onClick}
        >
            <TrendingUp 
                className="mr-1 rotate-90" 
                style={{ color: colors.base, width: 18, height: 18 }} 
            />
            <div className="text-[11px]" style={{ color: colors.base }}>
                {ideaTextComponent}
            </div>
        </div>
    );
};

export const ChartRecBox: FC<ChartRecBoxProps> = function ({ tableId, placeHolderChartId, className }) {
    const dispatch = useDispatch<AppDispatch>();

    // reference to states
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const config = useSelector((state: DataFormulatorState) => state.config);
    const agentRules = useSelector((state: DataFormulatorState) => state.agentRules);
    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);
    const activeModel = useSelector(dfSelectors.getActiveModel);


    let preferredMode = (
        activeModel.model == 'gpt-5' ||
        activeModel.model.startsWith('claude-sonnet-4') ||
        activeModel.model.startsWith('claude-opus-4') ||
        activeModel.model.startsWith('o1') ||
        activeModel.model.startsWith('o3') ||
        activeModel.model == 'gpt-4.1'
    ) ? "agent" : "interactive";

    const [mode, setMode] = useState<'agent' | 'interactive'>(preferredMode as 'agent' | 'interactive');

    const focusNextChartRef = useRef<boolean>(true);
    
    // Get mode color
    const modeColor = modeColors[mode];
    
    const [prompt, setPrompt] = useState<string>("");
    const [isFormulating, setIsFormulating] = useState<boolean>(false);
    const [ideas, setIdeas] = useState<{text: string, goal: string, difficulty: 'easy' | 'medium' | 'hard'}[]>([]);
    
    const [agentIdeas, setAgentIdeas] = useState<{
        questions: string[], goal: string, 
        difficulty: 'easy' | 'medium' | 'hard' }[]>([]);

    const [thinkingBuffer, setThinkingBuffer] = useState<string>("");

    let thinkingBufferEffect = <ThinkingBufferEffect text={thinkingBuffer.slice(-60)} sx={{ width: '46%' }} />;
    
    // Add state for loading ideas
    const [isLoadingIdeas, setIsLoadingIdeas] = useState<boolean>(false);

    // Use the provided tableId and find additional available tables for multi-table operations
    const currentTable = tables.find(t => t.id === tableId);

    const availableTables = tables.filter(t => t.derive === undefined || t.anchored);
    const [additionalTableIds, setAdditionalTableIds] = useState<string[]>([]);

    // Combine the main tableId with additional selected tables
    const selectedTableIds = currentTable?.derive ? [...currentTable.derive.source, ...additionalTableIds] : [tableId, ...additionalTableIds];

    const handleTableSelectionChange = (newTableIds: string[]) => {
        // Filter out the main tableId since it's always included
        const additionalIds = newTableIds.filter(id => id !== tableId);
        setAdditionalTableIds(additionalIds);
    };

    // Function to get a question from the list with cycling
    const getQuestion = (): string => {
        return mode === "agent" ? "let's explore something interesting about the data" : "show something interesting about the data";
    };

    // Function to get ideas from the interactive explore agent
    const getIdeasFromAgent = async (mode: 'interactive' | 'agent', startQuestion?: string, autoRunFirstIdea: boolean = false) => {
        if (!currentTable || isLoadingIdeas) {
            return;
        }

        setIsLoadingIdeas(true);
        setThinkingBuffer("");
        if (mode === "agent") {
            setAgentIdeas([]);
        } else {
            setIdeas([]);
        }

        try {
            // Determine the root table and derived tables context
            let explorationThread: any[] = [];
            let sourceTables = selectedTableIds.map(id => tables.find(t => t.id === id) as DictTable);

            // If current table is derived, find the root table and build exploration thread
            if (currentTable.derive && !currentTable.anchored) {
                // Find the root table (anchored or not derived)
                let triggers = getTriggers(currentTable, tables);
                
                // Build exploration thread with all derived tables in the chain
                explorationThread = triggers
                    .map(trigger => ({
                        name: trigger.resultTableId,
                        rows: tables.find(t2 => t2.id === trigger.resultTableId)?.rows,
                        description: `Derive from ${trigger.sourceTableIds} with instruction: ${trigger.instruction}`,
                    }));
            }

            const messageBody = JSON.stringify({
                token: String(Date.now()),
                model: activeModel,
                start_question: startQuestion,
                mode: mode,
                input_tables: sourceTables.map(t => ({
                    name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/, ""),
                    rows: t.rows,
                    attached_metadata: t.attachedMetadata
                })),
                language: currentTable.virtual ? "sql" : "python",
                exploration_thread: explorationThread,
                agent_exploration_rules: agentRules.exploration
            });

            const engine = getUrls().GET_RECOMMENDATION_QUESTIONS;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.formulateTimeoutSeconds * 1000); 

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

            let runNextIdea = autoRunFirstIdea;
            let updateState = (lines: string[]) => {
                let dataBlocks = lines
                    .map(line => {
                        try { return JSON.parse(line.trim()); } catch (e) { return null; }})
                    .filter(block => block != null);

                if (mode === "agent") {
                    let questions = dataBlocks.map(block => ({
                        questions: block.questions,
                        goal: block.goal,
                        difficulty: block.difficulty
                    }));
                    const newIdeas = questions.map((question: any) => ({
                        questions: question.questions,
                        goal: question.goal,
                        difficulty: question.difficulty
                    }));
                    if (runNextIdea) {
                        runNextIdea = false;
                        exploreDataFromNL(newIdeas[0].questions);
                    }
                    setAgentIdeas(newIdeas);
                } else {
                    let questions = dataBlocks.map(block => ({
                        text: block.text,
                        goal: block.goal,
                        difficulty: block.difficulty,
                        tag: block.tag
                    }));
                    setIdeas(questions);
                }
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
            console.error('Error getting ideas from agent:', error);
            dispatch(dfActions.addMessages({
                "timestamp": Date.now(),
                "type": "error",
                "component": "chart builder",
                "value": "Failed to get ideas from the exploration agent. Please try again.",
                "detail": error instanceof Error ? error.message : 'Unknown error'
            }));
        } finally {
            setIsLoadingIdeas(false);
            setThinkingBuffer("");
        }
    };

    useEffect(() => {
        if (mode === "agent") {
            setAgentIdeas([]);
        } else {
            setIdeas([]);
        }
        
    }, [tableId]);

    // Handle tab key press for auto-completion
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            if (prompt.trim() === "") {
                setPrompt(getQuestion());
            }
        } else if (event.key === 'Enter' && prompt.trim() !== "") {
            event.preventDefault();
            focusNextChartRef.current = true;
            if (mode === "agent") {
                exploreDataFromNLWithStartingQuestion(prompt.trim());
            } else {
                deriveDataFromNL(prompt.trim());
            }
        }
    };

    const deriveDataFromNL = (instruction: string) => {

        if (selectedTableIds.length === 0 || instruction.trim() === "") {
            return;
        }

        let originateChartId: string;

        if (placeHolderChartId) {
            //dispatch(dfActions.updateChartType({chartType: "Auto", chartId: placeHolderChartId}));
            dispatch(dfActions.changeChartRunningStatus({chartId: placeHolderChartId, status: true}));
            originateChartId = placeHolderChartId;
        } 

        const actionTables = selectedTableIds.map(id => tables.find(t => t.id === id) as DictTable);

        const actionId = `deriveDataFromNL_${String(Date.now())}`;
        dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, tableId: tableId, description: instruction, status: 'running', hidden: false}));

        // Validate table selection
        const firstTableId = selectedTableIds[0];
        if (!firstTableId) {
            dispatch(dfActions.addMessages({
                "timestamp": Date.now(),
                "type": "error",
                "component": "chart builder",
                "value": "No table selected for data formulation.",
            }));
            return;
        }

        // Generate table ID
        const genTableId = () => {
            let tableSuffix = Number.parseInt((Date.now() - Math.floor(Math.random() * 10000)).toString().slice(-6));
            let tableId = `table-${tableSuffix}`;
            while (tables.find(t => t.id === tableId) !== undefined) {
                tableSuffix = tableSuffix + 1;
                tableId = `table-${tableSuffix}`;
            }
            return tableId;
        };

        setIsFormulating(true);

        const token = String(Date.now());
        let messageBody = JSON.stringify({
            token: token,
            mode: 'formulate',
            input_tables: actionTables.map(t => ({
                name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/, ""),
                rows: t.rows,
                attached_metadata: t.attachedMetadata
            })),
            
            chart_type: "",
            chart_encodings: {},

            extra_prompt: instruction,
            model: activeModel,
            max_repair_attempts: config.maxRepairAttempts,
            agent_coding_rules: agentRules.coding,
            language: actionTables.some(t => t.virtual) ? "sql" : "python"
        });
        let engine = getUrls().DERIVE_DATA;
        
        if (currentTable && currentTable.derive?.dialog && !currentTable.anchored) {
            let sourceTableIds = currentTable.derive?.source;

            let startNewDialog = (!sourceTableIds.every(id => selectedTableIds.includes(id)) || 
                !selectedTableIds.every(id => sourceTableIds.includes(id)));

            // Compare if source and base table IDs are different
            if (startNewDialog) {

                let additionalMessages = currentTable.derive.dialog;

                // in this case, because table ids has changed, we need to use the additional messages and reformulate
                messageBody = JSON.stringify({
                    token: token,
                    mode: 'formulate',
                    input_tables: actionTables.map(t => {
                        return { 
                            name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/ , ""), 
                            rows: t.rows, 
                            attached_metadata: t.attachedMetadata 
                        }}),
                    chart_type: "",
                    chart_encodings: {},

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
                    mode: 'formulate',
                    input_tables: actionTables.map(t => {
                        return { 
                            name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/ , ""), 
                            rows: t.rows, 
                            attached_metadata: t.attachedMetadata 
                        }}),
                        
                    chart_type: "",
                    chart_encodings: {},
                    
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
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.formulateTimeoutSeconds * 1000);

        fetch(engine, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: messageBody,
            signal: controller.signal
        })
        .then((response) => response.json())
        .then((data) => {
            setIsFormulating(false);

            dispatch(dfActions.changeChartRunningStatus({chartId: originateChartId, status: false}));

            if (data.results.length > 0) {
                if (data["token"] === token) {
                    const candidates = data["results"].filter((item: any) => item["status"] === "ok");

                    if (candidates.length === 0) {
                        const errorMessage = data.results[0].content;
                        const code = data.results[0].code;

                        dispatch(dfActions.addMessages({
                            "timestamp": Date.now(),
                            "type": "error",
                            "component": "chart builder",
                            "value": `Data formulation failed, please try again.`,
                            "code": code,
                            "detail": errorMessage
                        }));
                    } else {
                        const candidate = candidates[0];
                        const code = candidate["code"];
                        const rows = candidate["content"]["rows"];
                        const dialog = candidate["dialog"];
                        const refinedGoal = candidate['refined_goal'];
                        const displayInstruction = refinedGoal['display_instruction'];

                        const candidateTableId = candidate["content"]["virtual"] 
                            ? candidate["content"]["virtual"]["table_name"] 
                            : genTableId();

                        // Create new table
                        const candidateTable = createDictTable(
                            candidateTableId,
                            rows,
                            undefined // No derive info for ChartRecBox - it's NL-driven without triggers
                        );

                        let refChart = generateFreshChart(tableId, 'Auto') as Chart;
                        refChart.source = 'trigger';
                        
                        // Add derive info manually since ChartRecBox doesn't use triggers
                        candidateTable.derive = {
                            code: code,
                            source: selectedTableIds,
                            dialog: dialog,
                            trigger: {
                                tableId: tableId,
                                sourceTableIds: selectedTableIds,
                                instruction: instruction,
                                displayInstruction: displayInstruction,
                                chart: refChart, // No upfront chart reference
                                resultTableId: candidateTableId
                            }
                        };

                        if (candidate["content"]["virtual"] != null) {
                            candidateTable.virtual = {
                                tableId: candidate["content"]["virtual"]["table_name"],
                                rowCount: candidate["content"]["virtual"]["row_count"]
                            };
                        }

                        dispatch(dfActions.insertDerivedTables(candidateTable));

                        // Add missing concept items
                        const names = candidateTable.names;
                        const missingNames = names.filter(name => 
                            !conceptShelfItems.some(field => field.name === name)
                        );

                        const conceptsToAdd = missingNames.map((name) => ({
                            id: `concept-${name}-${Date.now()}`,
                            name: name,
                            type: "auto" as Type,
                            description: "",
                            source: "custom",
                            tableRef: "custom",
                            temporary: true,
                        } as FieldItem));

                        dispatch(dfActions.addConceptItems(conceptsToAdd));
                        dispatch(fetchFieldSemanticType(candidateTable));
                        dispatch(fetchCodeExpl(candidateTable));

                        // Create proper chart based on refined goal
                        const currentConcepts = [...conceptShelfItems.filter(c => names.includes(c.name)), ...conceptsToAdd];
                        
                        let newChart = resolveRecommendedChart(refinedGoal, currentConcepts, candidateTable);

                        dispatch(dfActions.addChart(newChart));
                        // Create and focus the new chart directly
                        if (focusNextChartRef.current || AUTO_FOCUS_NEW_CHART) {
                            focusNextChartRef.current = false;  // Immediate, synchronous update
                            dispatch(dfActions.setFocusedChart(newChart.id));
                            dispatch(dfActions.setFocusedTable(candidateTable.id));
                        }

                        dispatch(dfActions.addMessages({
                            "timestamp": Date.now(),
                            "component": "chart builder",
                            "type": "success",
                            "value": `Data formulation: "${displayInstruction}"`
                        }));

                        // Clear the prompt after successful formulation
                        setPrompt("");
                    }
                }
                dispatch(dfActions.deleteAgentWorkInProgress(actionId));
            } else {
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder", 
                    "type": "error",
                    "value": "No result is returned from the data formulation agent. Please try again."
                }));
                
                setIsFormulating(false);
                dispatch(dfActions.deleteAgentWorkInProgress(actionId));
            }
        })
        .catch((error) => {
            setIsFormulating(false);
            dispatch(dfActions.changeChartRunningStatus({chartId: originateChartId, status: false}));   

            if (error.name === 'AbortError') {
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "error", 
                    "value": `Data formulation timed out after ${config.formulateTimeoutSeconds} seconds. Consider breaking down the task, using a different model or prompt, or increasing the timeout limit.`,
                    "detail": "Request exceeded timeout limit"
                }));
                dispatch(dfActions.deleteAgentWorkInProgress(actionId));
            } else {
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "error",
                    "value": `Data formulation failed, please try again.`,
                    "detail": error.message
                }));
                dispatch(dfActions.deleteAgentWorkInProgress(actionId));
            }
        });
    };

    const exploreDataFromNLWithStartingQuestion = (startingQuestion: string) => {
        getIdeasFromAgent('agent', `starting question: ${startingQuestion}\n\n generate only one question group that contains a deepdive question with 3 steps based on the starting question`, true);
    };

    const exploreDataFromNL = (initialPlan: string[]) => {

        let actionId = `exploreDataFromNL_${String(Date.now())}`;

        console.log('initialPlan', initialPlan)

        if (selectedTableIds.length === 0 || initialPlan.length === 0 || initialPlan[0].trim() === "") {
            return;
        }

        setIsFormulating(true);
        dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, tableId: tableId, description: initialPlan[0], status: 'running', hidden: false}));

        let actionTables = selectedTableIds.map(id => tables.find(t => t.id === id) as DictTable);

        const token = String(Date.now());
        let messageBody = JSON.stringify({
            token: token,
            input_tables: actionTables.map(t => ({
                name: t.virtual?.tableId || t.id.replace(/\.[^/.]+$/, ""),
                rows: t.rows,
                attached_metadata: t.attachedMetadata
            })),
            initial_plan: initialPlan,
            model: activeModel,
            max_iterations: 3,
            max_repair_attempts: config.maxRepairAttempts,
            agent_exploration_rules: agentRules.exploration,
            agent_coding_rules: agentRules.coding,
            language: actionTables.some(t => t.virtual) ? "sql" : "python",
        });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.formulateTimeoutSeconds * 6 * 1000);

        // State for accumulating streaming results
        let allResults: any[] = [];
        let createdTables: DictTable[] = [];
        let createdCharts: Chart[] = [];
        let allNewConcepts: FieldItem[] = [];
        let isCompleted = false;

        // Generate table ID helper
        const genTableId = () => {
            let tableSuffix = Number.parseInt((Date.now() - Math.floor(Math.random() * 10000)).toString().slice(-6));
            let tableId = `table-${tableSuffix}`;
            while (tables.find(t => t.id === tableId) !== undefined) {
                tableSuffix = tableSuffix + 1;
                tableId = `table-${tableSuffix}`;
            }
            return tableId;
        };

        // Function to process a single streaming result
        const processStreamingResult = (result: any) => {

            if (result.type === "planning") {
                dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, description: result.content.message, status: 'running', hidden: false}));
            }

            if (result.type === "data_transformation" && result.status === "success") {
                // Extract from the new structure: content.result instead of transform_result
                const transformResult = result.content.result;
                
                if (!transformResult || transformResult.status !== 'ok') {
                    return; // Skip failed transformations
                }
                
                const transformedData = transformResult.content;
                const code = transformResult.code;
                const dialog = transformResult.dialog;
                const refinedGoal = transformResult.refined_goal;
                const question = result.content.question;
                
                if (!transformedData || !transformedData.rows || transformedData.rows.length === 0) {
                    return; // Skip empty results
                }

                const rows = transformedData.rows;
                const candidateTableId = transformedData.virtual?.table_name || genTableId();
                const displayInstruction = refinedGoal?.display_instruction || `Exploration step ${createdTables.length + 1}: ${question}`;

                // Determine the trigger table and source tables for this iteration
                const isFirstIteration = createdTables.length === 0;
                const triggerTableId = isFirstIteration ? tableId : createdTables[createdTables.length - 1].id;

                // Create new table
                const candidateTable = createDictTable(
                    candidateTableId,
                    rows,
                    undefined // No derive info initially
                );

                // Add derive info manually for exploration results
                candidateTable.derive = {
                    code: code || `# Exploration step ${createdTables.length + 1}`,
                    source: selectedTableIds,
                    dialog: dialog || [],
                    trigger: {
                        tableId: triggerTableId,
                        sourceTableIds: selectedTableIds,
                        instruction: question,
                        displayInstruction: displayInstruction,
                        chart: undefined, // Will be set after chart creation
                        resultTableId: candidateTableId
                    }
                };

                if (transformedData.virtual) {
                    candidateTable.virtual = {
                        tableId: transformedData.virtual.table_name,
                        rowCount: transformedData.virtual.row_count
                    };
                }

                createdTables.push(candidateTable);

                dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, tableId: candidateTable.id, description: '', status: 'running', hidden: false}));

                // Add missing concept items for this table
                const names = candidateTable.names;
                const missingNames = names.filter(name => 
                    !conceptShelfItems.some(field => field.name === name) &&
                    !allNewConcepts.some(concept => concept.name === name)
                );

                const conceptsToAdd = missingNames.map((name) => ({
                    id: `concept-${name}-${Date.now()}-${Math.random()}`,
                    name: name,
                    type: "auto" as Type,
                    description: "",
                    source: "custom",
                    tableRef: "custom",
                    temporary: true,
                } as FieldItem));

                allNewConcepts.push(...conceptsToAdd);

                // Create trigger chart for derive info
                let triggerChart = generateFreshChart(actionTables[0].id, 'Auto') as Chart;
                triggerChart.source = 'trigger';

                // Update the derive trigger to reference the trigger chart
                if (candidateTable.derive) {
                    candidateTable.derive.trigger.chart = triggerChart;
                }

                // Resolve chart fields for regular chart if we have them
                if (refinedGoal) {
                    const currentConcepts = [...conceptShelfItems.filter(c => names.includes(c.name)), ...allNewConcepts, ...conceptsToAdd];
                    let newChart = resolveRecommendedChart(refinedGoal, currentConcepts, candidateTable);
                    createdCharts.push(newChart);

                    dispatch(dfActions.addChart(newChart));
                    if (focusNextChartRef.current || AUTO_FOCUS_NEW_CHART) {
                        focusNextChartRef.current = false;  // Immediate, synchronous update
                        dispatch(dfActions.setFocusedChart(newChart.id));
                        dispatch(dfActions.setFocusedTable(candidateTable.id));
                    }
                }
                
                // Immediately add the new concepts, table, and chart to the state
                if (conceptsToAdd.length > 0) {
                    dispatch(dfActions.addConceptItems(conceptsToAdd));
                }

                dispatch(dfActions.insertDerivedTables(candidateTable));
                dispatch(fetchFieldSemanticType(candidateTable));
                dispatch(fetchCodeExpl(candidateTable));

                // Show progress message
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "info",
                    "value": `Exploration step ${createdTables.length} completed: ${displayInstruction}`
                }));
            }
        };

        // Function to handle completion
        const handleCompletion = () => {
            if (isCompleted) return;
            isCompleted = true;

            console.log('in completion state')

            setIsFormulating(false);
            clearTimeout(timeoutId);

            const completionResult = allResults.find((result: any) => result.type === "completion");

            console.log('completionResult', completionResult)
            if (completionResult) {
                // Get completion message from completion result if available
                let summary = completionResult.content.message || "";
                let status : "running" | "completed" | "warning" | "failed" = completionResult.status === "success" ? "completed" : "warning";

                dispatch(dfActions.updateAgentWorkInProgress({
                    actionId: actionId, description: summary, status: status, hidden: false
                }));

                let completionMessage = `Data exploration completed.`;

                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "success",
                    "value": completionMessage
                }));

                // Clear the prompt after successful exploration
                setPrompt("");
            } else {
                dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, description: "The agent got lost in the data.", status: 'warning', hidden: false}));

                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "error",
                    "value": "The agent got lost in the data. Please try again."
                }));
            }
        };

        fetch(getUrls().EXPLORE_DATA_STREAMING, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: messageBody,
            signal: controller.signal
        })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        handleCompletion();
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    
                    // Split by newlines to get individual JSON objects
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

                    // should be only one message per line
                    for (let line of lines) {
                        if (line.trim() !== "") {
                            try {
                                const data = JSON.parse(line);
                                if (data.token === token) {
                                    if (data.status === "ok" && data.result) {
                                        allResults.push(data.result);
                                        
                                        processStreamingResult(data.result);
                                        
                                        // Check if this is a completion result
                                        if (data.result.type === "completion") {
                                            handleCompletion();
                                            return;
                                        }
                                    } else if (data.status === "error") {
                                        setIsFormulating(false);
                                        clearTimeout(timeoutId);
                                        
                                        // Clean up the inprogress thinking when streaming fails
                                        dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, description: data.error_message || "Error during data exploration", status: 'failed', hidden: false}));
                                        
                                        dispatch(dfActions.addMessages({
                                            "timestamp": Date.now(),
                                            "component": "chart builder", 
                                            "type": "error",
                                            "value": data.error_message || "Error during data exploration. Please try again."
                                        }));
                                        return;
                                    }
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse streaming response:', parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        })
        .catch((error) => {
            setIsFormulating(false);
            clearTimeout(timeoutId);
            
            // Clean up the inprogress thinking when network errors occur
            const errorMessage = error.name === 'AbortError' ? "Data exploration timed out" : `Data exploration failed: ${error.message}`;
            dispatch(dfActions.updateAgentWorkInProgress({actionId: actionId, description: errorMessage, status: 'failed', hidden: false}));
            
            if (error.name === 'AbortError') {
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "error",
                    "value": "Data exploration timed out. Please try again.",
                    "detail": error.message
                }));
            } else {
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "chart builder",
                    "type": "error",
                    "value": `Data exploration failed: ${error.message}`,
                    "detail": error.message
                }));
            }
        });
    };

    const showTableSelector = availableTables.length > 1 && currentTable;

    
    return (
        <div className={cn("max-w-[600px] flex flex-col", className)}>
            <div className="flex items-center gap-1">
                <div className="ml-1 flex">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className={cn(
                            "text-[10px] font-medium rounded rounded-b-none px-1.5 py-0.5 h-auto min-w-0",
                            mode === "interactive" ? "text-pink-500 bg-pink-500/10" : "text-muted-foreground bg-transparent"
                        )}
                        onClick={() => setMode("interactive")}
                    >
                        interactive
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className={cn(
                            "text-[10px] font-medium rounded rounded-b-none px-1.5 py-0.5 h-auto min-w-0",
                            mode === "agent" ? "text-indigo-500 bg-indigo-500/10" : "text-muted-foreground bg-transparent"
                        )}
                        onClick={() => setMode("agent")}
                    >
                        agent
                    </Button>
                </div>
            </div>
            <Card 
                className="px-4 flex flex-col gap-1 relative border-[1.5px]"
                style={{ borderColor: modeColor.base }}
            >
                {isFormulating && (
                    <div className="absolute top-0 left-0 right-0 z-[1000] h-1 overflow-hidden rounded-t">
                        <div 
                            className="h-full animate-pulse"
                            style={{ backgroundColor: modeColor.medium }}
                        >
                            <div 
                                className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite]"
                                style={{ backgroundColor: modeColor.base }}
                            />
                        </div>
                    </div>
                )}
                {showTableSelector && (
                    <div>
                        <NLTableSelector
                            selectedTableIds={selectedTableIds}
                            tables={availableTables}
                            updateSelectedTableIds={handleTableSelectionChange}
                            requiredTableIds={[tableId]}
                        />
                    </div>
                )}

                <div className="flex flex-row gap-1 items-end">
                    <div className="flex-1 relative">
                        <Textarea
                            className="text-sm border-0 focus-visible:ring-0 resize-none min-h-[56px]"
                            disabled={isFormulating || isLoadingIdeas}
                            onChange={(event) => setPrompt(event.target.value)}
                            onKeyDown={handleKeyDown}
                            value={prompt}
                            placeholder={getQuestion()}
                            rows={2}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 bottom-1"
                                        disabled={isFormulating || isLoadingIdeas || !currentTable || prompt.trim() === ""}
                                        style={{ color: modeColor.base }}
                                        onClick={() => { 
                                            focusNextChartRef.current = true;
                                            if (mode === "agent") {
                                                exploreDataFromNLWithStartingQuestion(prompt.trim());
                                            } else {
                                                deriveDataFromNL(prompt.trim());
                                            }
                                        }}
                                    >
                                        {isFormulating ? (
                                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: modeColor.base }} />
                                        ) : mode === "agent" ? (
                                            <TrendingUp className="h-6 w-6 rotate-90" />
                                        ) : (
                                            <Cog className="h-6 w-6" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Generate chart from description</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Separator orientation="vertical" className="h-auto self-stretch" />
                    <div className="flex items-center justify-center flex-col gap-0.5 my-1">
                        <span className="text-[10px] text-muted-foreground mb-0.5">
                            ideas?
                        </span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isFormulating || isLoadingIdeas || !currentTable}
                                        style={{ color: modeColor.base }}
                                        onClick={() => getIdeasFromAgent(mode)}
                                    >
                                        {isLoadingIdeas ? (
                                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: modeColor.base }} />
                                        ) : (
                                            <Lightbulb 
                                                className={cn(
                                                    "h-6 w-6",
                                                    ideas.length === 0 && "animate-pulse"
                                                )}
                                            />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Get some ideas!</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </Card>
            {mode === 'interactive' && (ideas.length > 0 || thinkingBuffer) && (
                <div className="flex flex-wrap gap-0.5 py-1">
                    {ideas.map((idea, index) => (
                        <IdeaChip
                            mini
                            key={index}
                            idea={idea}
                            onClick={() => {
                                focusNextChartRef.current = true;
                                setPrompt(idea.text);
                                deriveDataFromNL(idea.text);
                            }}
                            disabled={isFormulating}
                            className="w-[calc(50%-16px)]"
                        />
                    ))}
                    {isLoadingIdeas && thinkingBuffer && thinkingBufferEffect}
                </div>
            )}
            {mode === 'agent' && (agentIdeas.length > 0 || thinkingBuffer) && (
                <div className="flex flex-wrap gap-0.5 mb-1 py-1">
                    {agentIdeas.map((idea, index) => (
                        <AgentIdeaChip
                            mini
                            key={index}
                            idea={idea}
                            onClick={() => {
                                focusNextChartRef.current = true;
                                exploreDataFromNL(idea.questions);
                            }}
                            disabled={isFormulating}
                            className="w-[calc(50%-16px)]"
                        />
                    ))}
                    {isLoadingIdeas && thinkingBuffer && thinkingBufferEffect}
                </div>
            )}
        </div>
    );
};