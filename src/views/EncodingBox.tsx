// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { DataFormulatorState, dfActions, dfSelectors } from '../app/dfSlice';

import { useDrag, useDrop } from 'react-dnd'

import React from 'react';

import { ChevronDown, RefreshCw, BarChart3, Layers, Calendar, HelpCircle, X } from 'lucide-react';

import { FieldItem, Channel, EncodingItem, AggrOp, AGGR_OP_LIST, 
        ConceptTransformation, Chart, duplicateField } from "../components/ComponentType";
import { EncodingDropResult } from "../views/ConceptShelf";

import _ from 'lodash';

import '../scss/EncodingShelf.scss';
import AnimateHeight from 'react-animate-height';
import { getIconFromDtype, getIconFromType, groupConceptItems } from './ViewUtils';
import { getUrls } from '../app/utils';
import { Type } from '../data/types';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';



let getChannelDisplay = (channel: Channel) => {
    if (channel == "x") {
        return "x-axis";
    } else if (channel == "y") {
        return "y-axis";
    }
    return channel;
}

export interface LittleConceptCardProps {
    channel: Channel,
    field: FieldItem,
    encoding: EncodingItem,
    handleUnbind: () => void,
    tableMetadata: {[key: string]: {type: Type, semanticType: string, levels?: any[]}}
}

export const LittleConceptCard: FC<LittleConceptCardProps> = function LittleConceptCard({ channel, field, encoding, handleUnbind, tableMetadata }) {
    // concept cards are draggable cards that can be dropped into encoding shelf

    const [{ isDragging }, drag] = useDrag(() => ({
        type: "concept-card",
        item: { type: "concept-card", channel: channel, fieldID: field.id, source: "encodingShelf", encoding: encoding },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId(),
        })
    }));

    const opacity = isDragging ? 0.4 : 1;
    const cursorStyle = isDragging ? "grabbing" : "grab";

    let fieldClass = "encoding-active-item ";

    let bgColorClass = "bg-primary/5";

    if (field.source == "original") {
        bgColorClass = "bg-primary/5";
    } else if (field.source == "custom") {
        bgColorClass = "bg-purple-500/5";
    } else if (field.source == "derived") {
        bgColorClass = "bg-emerald-500/5";
    }

    return (
        <Badge
            ref={drag}
            className={cn(
                fieldClass,
                bgColorClass,
                "cursor-grab flex items-center gap-1 px-2 py-0.5 text-xs font-normal",
                isDragging && "opacity-40 cursor-grabbing"
            )}
            variant="secondary"
            onClick={(event) => {}}
        >
            {getIconFromType(tableMetadata[field.name]?.type || Type.Auto)}
            <span className="flex-grow flex-shrink truncate">{field.name}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleUnbind();
                }}
                className="ml-1 hover:text-destructive"
            >
                <X className="h-3 w-3" />
            </button>
        </Badge>
    )
}

// The property of an encoding box
export interface EncodingBoxProps {
    channel: Channel;
    chartId: string;
    tableId: string;
}

// the encoding boxes, allows 
export const EncodingBox: FC<EncodingBoxProps> = function EncodingBox({ channel, chartId, tableId }) {

    // use tables for infer domains
    const tables = useSelector((state: DataFormulatorState) => state.tables);

    let allCharts = useSelector(dfSelectors.getAllCharts);
    let activeModel = useSelector(dfSelectors.getActiveModel);
    
    let chart = allCharts.find(c => c.id == chartId) as Chart;
    let activeTable = tables.find(t => t.id == tableId);
    
    let encoding = chart.encodingMap[channel]; 

    let handleSwapEncodingField = (channel1: Channel, channel2: Channel) => {
        dispatch(dfActions.swapChartEncoding({chartId, channel1, channel2}))
    }
    
    let handleResetEncoding = () => {
        dispatch(dfActions.updateChartEncoding({chartId, channel, encoding: { }}));
    }

    // updating a property of the encoding
    let updateEncProp = (prop: keyof EncodingItem, value: any) => {
        dispatch(dfActions.updateChartEncodingProp({chartId, channel, prop: prop as string, value}));
    }

    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    let field = conceptShelfItems.find((x: FieldItem) => x.id == encoding.fieldID);
    let fieldMetadata = field?.name && activeTable?.metadata[field?.name] ? activeTable?.metadata[field?.name] : undefined;

    let [autoSortResult, setAutoSortResult] = useState<any[] | undefined>(fieldMetadata?.levels);
    let [autoSortInferRunning, setAutoSortInferRunning] = useState<boolean>(false);

    const dispatch = useDispatch();

    useEffect(() => { 
        if (field?.name && activeTable?.metadata[field?.name]) {
            let levels = activeTable?.metadata[field?.name].levels;
            setAutoSortResult(levels);

            if (!chart.chartType.includes("Area") && levels && levels.length > 0) {
                updateEncProp('sortBy', JSON.stringify(levels));
            }
        }
    }, [encoding.fieldID, activeTable])

    // make this a drop element for concepts
    const [{ canDrop, isOver }, drop] = useDrop(() => ({
        accept: ["concept-card", "operator-card"], // accepts only concept card items
        drop: (item: any): EncodingDropResult => {
            if (item.type === "concept-card") {
                if (item.source === "conceptShelf") {
                    handleResetEncoding();
                    updateEncProp('fieldID', item.fieldID);
                } else if (item.source === "encodingShelf") {
                    handleSwapEncodingField(channel, item.channel);
                } else {
                    console.log("field error")
                }
            }

            if (item.type === 'operator-card') {
                dispatch(dfActions.updateChartEncodingProp({chartId, channel, prop: 'aggregate', value: item.operator as AggrOp}));
            }

            return { channel: channel }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [chartId, encoding]); // add dependency

    //useEffect(() => {resetConfigOptions()}, [encoding]);

    // items that control the editor panel popover
    const [editMode, setEditMode] = React.useState<boolean>(false);


    const isActive = canDrop && isOver;
    let backgroundColor = '';
    if (isActive) {
        backgroundColor = 'rgba(204, 239, 255, 0.5)';
    } else if (canDrop) {
        backgroundColor = 'rgba(255, 251, 204, 0.5)';
    }

    let fieldComponent = field === undefined ? "" : (
        <LittleConceptCard channel={channel} key={`${channel}-${field.name}`} 
            tableMetadata={activeTable?.metadata || {}}
            field={field} encoding={encoding} 
            handleUnbind={() => {
            handleResetEncoding();
        }} />
    )

    // define anchor open
    let channelDisplay = getChannelDisplay(channel);

    let radioLabel = (label: string | React.ReactNode, value: any, key: string, width: number = 80, disabled: boolean = false, tooltip: string = "") => {
        let comp = (
            <div className="flex items-center space-x-1" style={{ width }} key={key}>
                <RadioGroupItem value={value} id={key} disabled={disabled} className="h-4 w-4" />
                <Label htmlFor={key} className={cn("flex items-center gap-1 text-xs cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
                    {label}
                </Label>
            </div>
        );
        if (tooltip != "") {
            comp = (
                <TooltipProvider key={`${key}-tooltip`}>
                    <Tooltip>
                        <TooltipTrigger asChild>{comp}</TooltipTrigger>
                        <TooltipContent className="bg-white/95 text-black border border-gray-400">
                            {tooltip}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }
        return comp;
    }

    


    let dataTypeOpt = [
        <Label key={`enc-box-${channel}-data-type-label`} className="text-xs" id="data-type-option-radio-buttons-group">Data Type</Label>,
        <div key={`enc-box-${channel}-data-type-form-control`} className="pb-0.5">
            <RadioGroup
                orientation="horizontal"
                className="flex flex-row flex-wrap w-40"
                value={encoding.dtype || "auto"}
                onValueChange={(value) => { 
                    if (value == "auto") {
                        updateEncProp("dtype", undefined);
                    } else {
                        updateEncProp("dtype", value as "quantitative" | "qualitative" | "temporal");
                    }
                }}
            >
                {radioLabel(getIconFromDtype("auto"), "auto", `dtype-auto`, 40, false, "auto")}
                {radioLabel(getIconFromDtype("quantitative"), "quantitative", `dtype-quantitative`, 40, false, "quantitative")}
                {radioLabel(getIconFromDtype("nominal"), "nominal", `dtype-nominal`, 40, false, "nominal")}
                {radioLabel(getIconFromDtype("temporal"), "temporal", `dtype-temporal`, 40, false, "temporal")}
            </RadioGroup>
        </div>
    ];

    let stackOpt = (chart.chartType == "bar" || chart.chartType == "area") && (channel == "x" || channel == "y") ? [
        <Label key={`enc-box-${channel}-stack-label`} className="text-xs" id="normalized-option-radio-buttons-group">Stack</Label>,
        <div key={`enc-box-${channel}-stack-form-control`} className="pb-0.5">
            <RadioGroup
                orientation="horizontal"
                className="flex flex-row flex-wrap w-40"
                value={encoding.stack || "default"}
                onValueChange={(value) => { updateEncProp("stack", value == "default" ? undefined : value); }}
            >
                {radioLabel("default", "default", `stack-default`)}
                {radioLabel("layered", "layered", `stack-layered`)}
                {radioLabel("center", "center", `stack-center`)}
                {radioLabel("normalize", "normalize", `stack-normalize`)}
            </RadioGroup>
        </div>
    ] : [];

    let domainItems = field ? activeTable?.rows.map(row => row[field?.name]) : [];
    domainItems = [...new Set(domainItems)];

    let autoSortEnabled = field && fieldMetadata?.type == Type.String && domainItems.length < 200;

    let autoSortFunction = () => {
        let token = domainItems.map(x => String(x)).join("--");
        setAutoSortInferRunning(true);
        let message = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({
                token: token,
                items: domainItems,
                field: field?.name,
                model: activeModel
            }),
        };

        fetch(getUrls().SORT_DATA_URL, message)
            .then((response) => response.json())
            .then((data) => {
                setAutoSortInferRunning(false);

                if (data["status"] == "ok") {
                    if (data["token"] == token) {
                        let candidate = data["result"][0];
                        
                        if (candidate['status'] == 'ok') {
                            let sortRes = {values: candidate['content']['sorted_values'], reason: candidate['content']['reason']}
                            setAutoSortResult(sortRes.values);
                        }
                    }
                } else {
                    // TODO: add warnings to show the user
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "component": "EncodingBox",
                        "type": "error",
                        "value": "unable to perform auto-sort."
                    }));
                    setAutoSortResult(undefined);
                }
            }).catch((error) => {
                setAutoSortInferRunning(false);
                setAutoSortResult(undefined);
               
                dispatch(dfActions.addMessages({
                    "timestamp": Date.now(),
                    "component": "EncodingBox",
                    "type": "error",
                    "value": "unable to perform auto-sort due to server issue."
                }));
            });
    }

    let sortByOptions = [
        radioLabel("auto", "auto", `sort-by-auto`)
    ]
    // TODO: check sort options
    if (channel == "x" && (fieldMetadata?.type == Type.String || fieldMetadata?.type == Type.Auto)) {
        sortByOptions.push(radioLabel("x", "x", `sort-x-by-x-ascending`, 80));
        sortByOptions.push(radioLabel("y", "y", `sort-x-by-y-ascending`, 80));
        sortByOptions.push(radioLabel("color", "color", `sort-x-by-color-ascending`, 80));
    }
    if (channel == "y" && (fieldMetadata?.type == Type.String || fieldMetadata?.type == Type.Auto)) {
        sortByOptions.push(radioLabel("x", "x", `sort-y-by-x-ascending`, 80));
        sortByOptions.push(radioLabel("y", "y", `sort-y-by-y-ascending`, 80));
        sortByOptions.push(radioLabel("color", "color", `sort-y-by-color-ascending`, 80));
    }
 
    if (autoSortEnabled) {
        if (autoSortInferRunning) {
            sortByOptions = [
                ...sortByOptions,
                <div className="flex items-center space-x-1 w-[180px]" key={"auto-btn"}>
                    <RadioGroupItem value={JSON.stringify(autoSortResult)} id="auto-sort-running" disabled={true} className="h-4 w-4" />
                    <Progress value={undefined} className="w-[120px] h-1 opacity-40" />
                </div>
            ]
        } else {
            if (autoSortResult != undefined && autoSortResult.length > 0) {

                let autoSortOptTitle = (
                    <div>
                        <div>
                            <span className="font-bold text-xs">Sort Order: </span> 
                            {autoSortResult.map(x => x ? x.toString() : 'null').join(", ")}
                        </div>
                    </div>
                );

                let autoSortOpt = (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="auto-sort-option-label truncate text-xs">
                                    {autoSortResult.map(x => x ? x.toString() : 'null').join(", ")}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white/95 text-black border border-gray-400">
                                {autoSortOptTitle}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );

                sortByOptions = [
                    ...sortByOptions,
                    <div className="flex items-center space-x-1 w-[180px]" key={"auto"}>
                        <RadioGroupItem 
                            value={JSON.stringify(autoSortResult)} 
                            id="auto-sort" 
                            disabled={autoSortInferRunning || !autoSortResult} 
                            className="h-4 w-4" 
                        />
                        <Label htmlFor="auto-sort" className="flex items-center w-full cursor-pointer">
                            {autoSortOpt}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={autoSortFunction} size="icon" variant="ghost" className="h-6 w-6 ml-1">
                                            <RefreshCw className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>rerun smart sort</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                    </div>
                ]
            } else {
                sortByOptions = [
                    ...sortByOptions,
                    <div className="flex items-center space-x-1 w-[180px]" key={"auto-btn"}>
                        <RadioGroupItem 
                            value={JSON.stringify(autoSortResult)} 
                            id="auto-sort-btn" 
                            disabled={autoSortInferRunning || !autoSortResult} 
                            className="h-4 w-4" 
                        />
                        <Button size="sm" variant="link" className="text-xs p-0.5 h-auto" onClick={autoSortFunction}>
                            infer smart sort order
                        </Button>
                    </div>
                ]
            }
        }
    }

    let sortByOpt = [
        <Label className="text-xs" key={`enc-box-${channel}-sort-label`} id="sort-option-radio-buttons-group">Sort By</Label>,
        <div key={`enc-box-${channel}-sort-form-control`} className="pb-1">
            <RadioGroup
                orientation="horizontal"
                className="flex flex-row flex-wrap w-[180px]"
                value={encoding.sortBy || 'auto'}
                onValueChange={(value) => { updateEncProp("sortBy", value) }}
            >
                {sortByOptions}
            </RadioGroup>
        </div>
    ]

    let sortOrderOpt = [
        <Label className="text-xs" key={`enc-box-${channel}-sort-order-label`} id="sort-option-radio-buttons-group">Sort Order</Label>,
        <div key={`enc-box-${channel}-sort-order-form-control`} className="pb-0.5">
            <RadioGroup
                orientation="horizontal"
                className="flex flex-row flex-wrap w-[180px]"
                value={encoding.sortOrder || "auto"}
                onValueChange={(value) => { updateEncProp("sortOrder", value) }}
            >
                {radioLabel("auto", "auto", `sort-auto`, 60)}
                {radioLabel("↑ asc", "ascending", `sort-ascending`, 60)}
                {radioLabel("↓ desc", "descending", `sort-descending`, 60)}
            </RadioGroup>
        </div>
    ]
    
    let colorSchemeList = [
        "category10",
        "category20",
        "tableau10",
        "blues",
        "oranges",
        "reds",
        "greys",
        "goldgreen",
        "bluepurple",
        "blueorange",
        "redyellowblue",
        "spectral"
    ]
    let colorSchemeOpt = channel == "color" ? [
            <Label className="text-xs" key={`enc-box-${channel}-color-scheme-label`} id="scheme-option-radio-buttons-group">Color scheme</Label>,
            <Select
                key="color-sel-form"
                value={encoding.scheme || "default"}
                onValueChange={(value) => { updateEncProp("scheme", value) }}
            >
                <SelectTrigger className="w-full h-7 text-xs">
                    <SelectValue placeholder="default" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default" className="text-xs italic">default</SelectItem>
                    {colorSchemeList.map((t, i) => (
                        <SelectItem value={t} key={`color-scheme-${i}`} className="text-xs">{t}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
    ] : []

    let encodingConfigCard = (
        <CardContent className="flex py-3 px-3 text-xs">
            <div className="mx-auto flex flex-col items-start w-fit text-center">
                {dataTypeOpt}
                {stackOpt}
                {sortByOpt}
                {sortOrderOpt}
                {colorSchemeOpt}
            </div>
        </CardContent>
    )

    let aggregateDisplay = encoding.aggregate ? (
        <Badge 
            key="aggr-display" 
            className={cn(
                "encoding-prop-chip bg-secondary/10 text-xs cursor-pointer",
                field == undefined && "w-full"
            )}
            variant="secondary"
        >
            {encoding.aggregate == "average" ? "avg" : encoding.aggregate}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    updateEncProp("aggregate", undefined);
                }}
                className="ml-1 hover:text-destructive"
            >
                <X className="h-3 w-3" />
            </button>
        </Badge>
    ) : "";
    let normalizedDisplay = encoding.stack ? (
        <Badge 
            key="normalized-display" 
            className="encoding-prop-chip bg-secondary/10 text-xs cursor-pointer"
            variant="secondary"
        >
            ⌸
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    updateEncProp("stack", undefined);
                }}
                className="ml-1 hover:text-destructive"
            >
                <X className="h-3 w-3" />
            </button>
        </Badge>
    ) : "";
    
    let handleSelectOption = (option: string) => {
        if (conceptShelfItems.map(f => f.name).includes(option)) {
            //console.log(`yah-haha: ${option}`);
            updateEncProp("fieldID", (conceptShelfItems.find(f => f.name == option) as FieldItem).id);
        } else {
            if (option == "") {
                console.log("nothing happens")
            } else {
                let newConept = {
                    id: `concept-${Date.now()}`, name: option, type: "auto" as Type, 
                    description: "", source: "custom", tableRef: "custom",
                } as FieldItem;
                dispatch(dfActions.updateConceptItems(newConept));
                updateEncProp("fieldID", newConept.id);
            }
            
        }
    }


    let conceptGroups = groupConceptItems(conceptShelfItems, tables);

    let groupNames = [...new Set(conceptGroups.map(g => g.group))];
    conceptGroups.sort((a, b) => {
        if (groupNames.indexOf(a.group) < groupNames.indexOf(b.group)) {
            return -1;
        } else if (groupNames.indexOf(a.group) > groupNames.indexOf(b.group)) {
            return 1;
        } else {
            return activeTable && activeTable.names.includes(a.field.name) && !activeTable.names.includes(b.field.name) ? -1 : 1;
        }
    })

    // State for popover open
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");

    let createConceptInputBox = (
        <Popover key="concept-create-input-box" open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    role="combobox"
                    className="flex-grow flex-shrink h-6 justify-start text-xs font-normal px-2 text-muted-foreground"
                >
                    {inputValue || "field"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                    <CommandInput 
                        placeholder="Search or create field..." 
                        value={inputValue}
                        onValueChange={setInputValue}
                        className="text-xs"
                    />
                    <CommandList className="max-h-[400px]">
                        <CommandEmpty>
                            {inputValue ? (
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start text-xs"
                                    onClick={() => {
                                        handleSelectOption(inputValue);
                                        setPopoverOpen(false);
                                        setInputValue("");
                                    }}
                                >
                                    Create "{inputValue}"
                                </Button>
                            ) : (
                                <span className="text-xs text-muted-foreground">Type a new field name</span>
                            )}
                        </CommandEmpty>
                        {groupNames.map((groupName) => (
                            <CommandGroup key={groupName} heading={groupName}>
                                <div className="grid grid-cols-2 gap-1 p-1">
                                    {conceptGroups
                                        .filter(g => g.group === groupName && g.field.name !== "")
                                        .map((g) => {
                                            const fieldItem = g.field;
                                            let bgColorClass = "bg-primary/20";
                                            if (fieldItem.source == "original") {
                                                bgColorClass = "bg-primary/20";
                                            } else if (fieldItem.source == "custom") {
                                                bgColorClass = "bg-purple-500/20";
                                            } else if (fieldItem.source == "derived") {
                                                bgColorClass = "bg-emerald-500/20";
                                            }

                                            const isInActiveTable = activeTable?.names.includes(fieldItem.name);
                                            
                                            return (
                                                <CommandItem
                                                    key={fieldItem.id}
                                                    value={fieldItem.name}
                                                    onSelect={() => {
                                                        handleSelectOption(fieldItem.name);
                                                        setPopoverOpen(false);
                                                        setInputValue("");
                                                    }}
                                                    className={cn(
                                                        "cursor-pointer text-[10px] px-2 py-1 rounded border",
                                                        bgColorClass,
                                                        !isInActiveTable && "opacity-60"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1 w-full">
                                                        {getIconFromType(activeTable?.metadata[fieldItem.name]?.type || Type.Auto)}
                                                        <span className="truncate flex-1">{fieldItem.name}</span>
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                </div>
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );

    // when there is no field added, allow users to directly type concepts here, and it will be created on the fly.
    const encContent = field == undefined ? 
        (encoding.aggregate == 'count' ? [ aggregateDisplay ] : [
            normalizedDisplay,
            aggregateDisplay,
            createConceptInputBox
        ]) 
        : 
        [
            normalizedDisplay,
            aggregateDisplay,
            fieldComponent
        ]

    // State for click away handling
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
                setEditMode(false);
            }
        };
        document.addEventListener('mouseup', handleClickOutside);
        return () => {
            document.removeEventListener('mouseup', handleClickOutside);
        };
    }, []);

    let encodingComp = (
        <div 
            ref={boxRef}
            className="flex flex-col items-start w-full mb-1 channel-shelf-box encoding-item"
        >
            <Card className={cn("w-full", editMode && "shadow-md")} >
                <div ref={drop} className="channel-encoded-field flex">
                    <button
                        onClick={() => { setEditMode(!editMode) }}
                        className={cn(
                            "p-0 rounded-none text-left text-xs h-auto",
                            "relative border-r border-gray-300 w-16 bg-black/[0.01]",
                            "flex justify-between items-center"
                        )}
                    >
                        <span className="text-xs pl-1.5">{channelDisplay}</span>
                        <ChevronDown className={cn(
                            "absolute right-0 pl-0.5 h-3 w-3 transition-transform",
                            editMode && "rotate-180"
                        )} />
                    </button>
                    <div className={cn(
                        "w-[calc(100%-64px)] flex items-center",
                        editMode && "border-b border-border"
                    )} style={{ backgroundColor }}>
                        {encContent}
                    </div>
                </div>
                <AnimateHeight
                    duration={200}
                    height={editMode ? "auto" : 0}
                >
                    {encodingConfigCard}
                </AnimateHeight>
            </Card>
        </div>
    )

    return encodingComp;
}