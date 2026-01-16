// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import _ from 'lodash';

import embed from 'vega-embed';

import '../scss/VisualizationView.scss';
import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions, getSessionId } from '../app/dfSlice';
import { assembleVegaChart, extractFieldsFromEncodingMap, getUrls, prepVisTable  } from '../app/utils';
import { Chart, EncodingItem, EncodingMap, FieldItem } from '../components/ComponentType';
import { DictTable } from "../components/ComponentType";

import { 
    PlusSquare, 
    Trash2, 
    Star, 
    Terminal, 
    MessageSquare, 
    X, 
    Copy, 
    ZoomIn, 
    ZoomOut, 
    FileText, 
    Filter, 
    Check, 
    Cloud, 
    Info, 
    Dice5, 
    TrendingUp, 
    Code 
} from 'lucide-react';

import { CHART_TEMPLATES, getChartTemplate } from '../components/ChartTemplates';

import Prism from 'prismjs'
import 'prismjs/components/prism-python' // Language
import 'prismjs/components/prism-sql' // Language
import 'prismjs/components/prism-markdown' // Language
import 'prismjs/components/prism-typescript' // Language
import 'prismjs/themes/prism.css'; //Example style, you can use another

import { ChatDialog } from './ChatDialog';
import { EncodingShelfThread } from './EncodingShelfThread';
import { CustomReactTable } from './ReactTable';

import ReactMarkdown from 'react-markdown';

import { dfSelectors } from '../app/dfSlice';
import { ChartRecBox } from './ChartRecBox';
import { CodeExplanationCard, ConceptExplCards, extractConceptExplanations } from './ExplComponents';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

export interface VisPanelProps { }

export interface VisPanelState {
    focusedIndex: number;
    focusUpdated: boolean;
    viewMode: "gallery" | "carousel";
}

export let generateChartSkeleton = (icon: any, width: number = 160, height: number = 160, opacity: number = 0.5) => (
    <div className={cn("flex")} style={{ width, height }}>
        {icon == undefined ?
            <PlusSquare className="m-auto text-gray-300" /> :
            typeof icon == 'string' ?
                <div className="w-full flex" style={{ opacity }}>
                    <img height={Math.min(64, height)} width={Math.min(64, width)}
                         style={{ maxHeight: Math.min(height, Math.max(32, 0.5 * height)), maxWidth: Math.min(width, Math.max(32, 0.5 * width)), margin: "auto" }} 
                         src={icon} alt="" role="presentation" />
                </div> :
                <div className="w-full flex" style={{ opacity }}>
                    {React.cloneElement(icon, {
                        style: { 
                            maxHeight: Math.min(height, 32),
                            maxWidth: Math.min(width, 32), 
                            margin: "auto" 
                        }
                    })}
                </div>}
    </div>
)

export let renderTableChart = (
    chart: Chart, conceptShelfItems: FieldItem[], extTable: any[], 
    width: number = 120, height: number = 120) => {

    let fields = Object.entries(chart.encodingMap).filter(([channel, encoding]) => {
        return encoding.fieldID != undefined;
    }).map(([channel, encoding]) => conceptShelfItems.find(f => f.id == encoding.fieldID) as FieldItem);

    if (fields.length == 0) {
        fields = conceptShelfItems.filter(f => Object.keys(extTable[0]).includes(f.name));
    }

    let rows = extTable.map(row => Object.fromEntries(fields.filter(f => Object.keys(row).includes(f.name)).map(f => [f.name, row[f.name]])))

    let colDefs = fields.map(field => {
        let name = field.name;
        return {
            id: name, label: name, minWidth: 30, align: undefined, 
            format: (value: any) => `${value}`, source: field.source
        }
    })

    return <div className="relative flex flex-col m-auto">
        <CustomReactTable rows={rows} columnDefs={colDefs} rowsPerPageNum={10} maxCellWidth={180} compact />
    </div>
}

export let getDataTable = (chart: Chart, tables: DictTable[], charts: Chart[], 
                           conceptShelfItems: FieldItem[], ignoreTableRef = false) => {
    // given a chart, determine which table would be used to visualize the chart

    // return the table directly
    if (chart.tableRef && !ignoreTableRef) {
        return tables.find(t => t.id == chart.tableRef) as DictTable;
    }

    let activeFields = conceptShelfItems.filter((field) => Array.from(Object.values(chart.encodingMap)).map((enc: EncodingItem) => enc.fieldID).includes(field.id));

    let workingTableCandidates = tables.filter(t => {
        return activeFields.every(f => t.names.includes(f.name));
    });
    
    let confirmedTableCandidates = workingTableCandidates.filter(t => !charts.some(c => c.saved && c.tableRef == t.id));
    if(confirmedTableCandidates.length > 0) {
        return confirmedTableCandidates[0];
    } else if (workingTableCandidates.length > 0) {
        return workingTableCandidates[0];
    } else {
        // sort base tables based on how many active fields are covered by existing tables
        return tables.filter(t => t.derive == undefined).sort((a, b) => activeFields.filter(f => a.names.includes(f.name)).length 
                                        - activeFields.filter(f => b.names.includes(f.name)).length).reverse()[0];
    }
}

export let CodeBox : FC<{code: string, language: string, fontSize?: number}> = function  CodeBox({ code, language, fontSize = 10 }) {
    useEffect(() => {
        Prism.highlightAll();
      }, [code]);

    return (
        <pre style={{fontSize: fontSize}}>
            <code className={`language-${language}`} >{code}</code>
        </pre>
    );
  }


export let checkChartAvailabilityOnPreparedData = (chart: Chart, conceptShelfItems: FieldItem[], visTableRows: any[]) => {
    let visFieldsFinalNames = Object.keys(chart.encodingMap)
            .filter(key => chart.encodingMap[key as keyof EncodingMap].fieldID != undefined)
            .map(key => [chart.encodingMap[key as keyof EncodingMap].fieldID, chart.encodingMap[key as keyof EncodingMap].aggregate])
            .map(([id, aggregate]) => {
                let field = conceptShelfItems.find(f => f.id == id);
                if (field) {
                    if (aggregate) {
                        return aggregate == "count" ? "_count" : `${field.name}_${aggregate}`;
                    } else {
                        return field.name;
                    }
                }
                return undefined;
            }).filter(f => f != undefined);
    return visFieldsFinalNames.length > 0 && visTableRows.length > 0 && visFieldsFinalNames.every(name => Object.keys(visTableRows[0]).includes(name));
}

export let checkChartAvailability = (chart: Chart, conceptShelfItems: FieldItem[], visTableRows: any[]) => {
    let visFieldIds = Object.keys(chart.encodingMap)
            .filter(key => chart.encodingMap[key as keyof EncodingMap].fieldID != undefined)
            .map(key => chart.encodingMap[key as keyof EncodingMap].fieldID);
    let visFields = conceptShelfItems.filter(f => visFieldIds.includes(f.id));
    return visFields.length > 0 && visTableRows.length > 0 && visFields.every(f => Object.keys(visTableRows[0]).includes(f.name));
}

export let SampleSizeEditor: FC<{
    initialSize: number;
    totalSize: number;
    onSampleSizeChange: (newSize: number) => void;
}> = function SampleSizeEditor({ initialSize, totalSize, onSampleSizeChange }) {

    const [localSampleSize, setLocalSampleSize] = useState<number>(initialSize);
    const [open, setOpen] = useState<boolean>(false);

    useEffect(() => {
        setLocalSampleSize(initialSize);
    }, [initialSize])

    let maxSliderSize = Math.min(totalSize, 30000);

    return <span className="flex flex-row items-center">
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost"
                    className="text-xs normal-case"
                >
                    {localSampleSize} / {totalSize}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[300px] p-4">
                <p className="text-sm mb-2">
                    Adjust sample size: {localSampleSize} / {totalSize} rows
                </p>
                <div className="flex flex-row items-center">
                    <span className="text-xs text-muted-foreground mr-2">100</span>
                    <Slider
                        className="mr-2 flex-1"
                        min={100}
                        max={maxSliderSize}
                        value={[localSampleSize]}
                        onValueChange={(value) => setLocalSampleSize(value[0])}
                        aria-label="Sample size"
                    />
                    <span className="text-xs text-muted-foreground ml-2">{maxSliderSize}</span>
                    <Button 
                        variant="ghost"
                        className="ml-2 text-xs normal-case"
                        onClick={() => {
                            onSampleSizeChange(localSampleSize);
                            setOpen(false);
                        }}
                    >
                        Resample
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    </span>
}

// Simple component that only handles Vega chart rendering
const VegaChartRenderer: FC<{
    chart: Chart;
    conceptShelfItems: FieldItem[];
    visTableRows: any[];
    tableMetadata: any;
    chartWidth: number;
    chartHeight: number;
    scaleFactor: number;
    chartUnavailable: boolean;
}> = React.memo(({ chart, conceptShelfItems, visTableRows, tableMetadata, chartWidth, chartHeight, scaleFactor, chartUnavailable }) => {
    
    const elementId = `focused-chart-element-${chart.id}`;
    
    useEffect(() => {
        
        if (chart.chartType === "Auto" || chart.chartType === "Table" || chartUnavailable) {
            return;
        }

        const assembledChart = assembleVegaChart(
            chart.chartType, 
            chart.encodingMap, 
            conceptShelfItems, 
            visTableRows, 
            tableMetadata, 
            24, 
            true, 
            chartWidth, 
            chartHeight,
            true
        );

        // Use "canvas" renderer for Vega charts instead of "svg".
        // Reason: Canvas provides better performance for large datasets and complex charts,
        // and avoids some SVG rendering issues in certain browsers. Note that this may affect
        // accessibility and text selection. If SVG features are needed, consider reverting.
        embed('#' + elementId, { ...assembledChart }, { actions: true, renderer: "canvas" })
        .then(function (result) {
            // any post-processing of the canvas can go here
        }).catch((error) => {
            //console.error('Chart rendering error:', error);
        });

    }, [chart.id, chart.chartType, chart.encodingMap, conceptShelfItems, visTableRows, tableMetadata, chartWidth, chartHeight, scaleFactor, chartUnavailable]);

    if (chart.chartType === "Auto") {
        return <div className="relative flex flex-col m-auto text-gray-400">
            <TrendingUp className="text-2xl"/>
        </div>
    }

    if (chart.chartType === "Table") {
        return visTableRows.length > 0 ? renderTableChart(chart, conceptShelfItems, visTableRows) : <div className="h-full flex items-center justify-center">
            <TrendingUp className="text-2xl"/>
        </div>;
    }

    const chartTemplate = getChartTemplate(chart.chartType);
    if (!checkChartAvailabilityOnPreparedData(chart, conceptShelfItems, visTableRows)) {
        return <div className="h-full flex items-center justify-center">
            {generateChartSkeleton(chartTemplate?.icon, 48, 48)}
        </div>
    }

    return <div id={elementId} className="mx-2"></div>;
});


export const ChartEditorFC: FC<{}> = function ChartEditorFC({}) {

    const config = useSelector((state: DataFormulatorState) => state.config);
    const componentRef = useRef<HTMLHeadingElement>(null);

    // Add ref for the container box that holds all exploration components
    const explanationComponentsRef = useRef<HTMLDivElement>(null);

    let tables = useSelector((state: DataFormulatorState) => state.tables);
    
    let charts = useSelector(dfSelectors.getAllCharts);
    let focusedChartId = useSelector((state: DataFormulatorState) => state.focusedChartId);
    let chartSynthesisInProgress = useSelector((state: DataFormulatorState) => state.chartSynthesisInProgress);

    let synthesisRunning = focusedChartId ? chartSynthesisInProgress.includes(focusedChartId) : false;
    let handleDeleteChart = () => { focusedChartId && dispatch(dfActions.deleteChartById(focusedChartId)) }

    let focusedChart = charts.find(c => c.id == focusedChartId) as Chart;
    let trigger = focusedChart.source == "trigger" ? tables.find(t => t.derive?.trigger?.chart?.id == focusedChartId)?.derive?.trigger : undefined;

    const dispatch = useDispatch();

    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    const [codeViewOpen, setCodeViewOpen] = useState<boolean>(false);
    const [codeExplViewOpen, setCodeExplViewOpen] = useState<boolean>(false);
    const [conceptExplanationsOpen, setConceptExplanationsOpen] = useState<boolean>(false);
    
    // Add new state for the explanation mode
    const [explanationMode, setExplanationMode] = useState<'none' | 'code' | 'explanation' | 'concepts'>('none');

    const [chatDialogOpen, setChatDialogOpen] = useState<boolean>(false);
    const [localScaleFactor, setLocalScaleFactor] = useState<number>(1);

    // Reset local UI state when focused chart changes
    useEffect(() => {
        setLocalScaleFactor(1);
        setCodeViewOpen(false);
        setCodeExplViewOpen(false);
        setConceptExplanationsOpen(false);
        setExplanationMode('none');
        setChatDialogOpen(false);
    }, [focusedChartId]);

    // Combined useEffect to scroll to exploration components when any of them open
    useEffect(() => {
        if ((conceptExplanationsOpen || codeViewOpen || codeExplViewOpen) && explanationComponentsRef.current) {
            setTimeout(() => {
                explanationComponentsRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 200); // Small delay to ensure the component is rendered
        }
    }, [conceptExplanationsOpen, codeViewOpen, codeExplViewOpen]);

    let table = getDataTable(focusedChart, tables, charts, conceptShelfItems);

    let visFieldIds = Object.keys(focusedChart.encodingMap).filter(key => focusedChart.encodingMap[key as keyof EncodingMap].fieldID != undefined).map(key => focusedChart.encodingMap[key as keyof EncodingMap].fieldID);
    let visFields = conceptShelfItems.filter(f => visFieldIds.includes(f.id));
    let dataFieldsAllAvailable = visFields.every(f => table.names.includes(f.name));

    // Create a stable identifier for data requirements (fields + aggregations)
    const dataRequirements = useMemo(() => {
        let { aggregateFields, groupByFields } = extractFieldsFromEncodingMap(focusedChart.encodingMap, conceptShelfItems);
        let sortedFields = [...aggregateFields.map(f => `${f[0]}_${f[1]}`), ...groupByFields].sort();

        return JSON.stringify({
            chartId: focusedChart.id,
            tableId: table.id,
            sortedFields
        });
    }, [focusedChart.encodingMap, conceptShelfItems, focusedChart.id, table.id]);

    let setSystemMessage = (content: string, severity: "error" | "warning" | "info" | "success") => {
        dispatch(dfActions.addMessages({
            "timestamp": Date.now(),
            "component": "Chart Builder",
            "type": severity,
            "value": content
        }));
    }

    let createVisTableRowsLocal = (rows: any[]) => {
        if (visFields.length == 0) {
            return rows;
        }
        
        let filteredRows = rows.map(row => Object.fromEntries(visFields.filter(f => table.names.includes(f.name)).map(f => [f.name, row[f.name]])));
        let visTable = prepVisTable(filteredRows, conceptShelfItems, focusedChart.encodingMap);

        if (visTable.length > 5000) {
            let rowSample = _.sampleSize(visTable, 5000);
            visTable = rowSample;
        }

        visTable = structuredClone(visTable);

        return visTable;
    }

    const processedData = createVisTableRowsLocal(table.rows);

    const [visTableRows, setVisTableRows] = useState<any[]>(processedData);
    const [visTableTotalRowCount, setVisTableTotalRowCount] = useState<number>(table.virtual?.rowCount || table.rows.length);
    

    let { aggregateFields, groupByFields } = extractFieldsFromEncodingMap(focusedChart.encodingMap, conceptShelfItems);
    let sortedVisDataFields = [...aggregateFields.map(f => `${f[0]}_${f[1]}`), ...groupByFields].sort();

    // Track which chart+table+requiredFields the current data belongs to (prevents showing stale data during transitions)
    const [dataVersion, setDataVersion] = useState<string>(`${focusedChart.id}-${table.id}-${sortedVisDataFields.join("_")}`);
    const currentRequestRef = useRef<string>('');
    
    // Check if current data is stale (belongs to different chart/table)
    const isDataStale = dataVersion !== `${focusedChart.id}-${table.id}-${sortedVisDataFields.join("_")}`;

    
    // Use empty data if stale to avoid showing incorrect data during transitions
    const activeVisTableRows = isDataStale ? [] : visTableRows;
    const activeVisTableTotalRowCount = isDataStale ? 0 : visTableTotalRowCount;

    async function fetchDisplayRows(sampleSize?: number) {
        if (sampleSize == undefined) {
            sampleSize = 1000;
        }
        if (table.virtual) {
            // Generate unique request ID to track this specific request
            const requestId = `${focusedChart.id}-${table.id}-${Date.now()}`;
            currentRequestRef.current = requestId;
            
            let { aggregateFields, groupByFields } = extractFieldsFromEncodingMap(focusedChart.encodingMap, conceptShelfItems);
            fetch(getUrls().SAMPLE_TABLE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    table: table.id,
                    size: sampleSize,
                    method: 'random',
                    select_fields: groupByFields,
                    aggregate_fields_and_functions: aggregateFields,
                }),
            })
            .then(response => response.json())
            .then(data => {
                // Only update if this is still the current request (not stale)
                if (currentRequestRef.current === requestId) {
                    const versionId = `${focusedChart.id}-${table.id}-${sortedVisDataFields.join("_")}`;
                    if (data.status == "success") {
                        setVisTableRows(data.rows);
                        setVisTableTotalRowCount(data.total_row_count);
                        setDataVersion(versionId);
                    } else {
                        setVisTableRows([]);
                        setVisTableTotalRowCount(0);
                        setDataVersion(versionId);
                        setSystemMessage(data.message, "error");
                    }
                }
                // Else: this response is stale, ignore it
            })
            .catch(error => {
                // Only show error if this is still the current request
                if (currentRequestRef.current === requestId) {
                    console.error('Error sampling table:', error);
                }
            });
        } else {
            // Randomly sample sampleSize rows from table.rows
            let rowSample = _.sampleSize(table.rows, sampleSize);
            setVisTableRows(structuredClone(rowSample));
            setDataVersion(`${focusedChart.id}-${table.id}-${sortedVisDataFields.join("_")}`);
        }
    }

    useEffect(() => {
        if (table.virtual && visFields.length > 0 && dataFieldsAllAvailable) {
            fetchDisplayRows();
        }
    }, [])

    useEffect(() => {
        const versionId = `${focusedChart.id}-${table.id}-${sortedVisDataFields.join("_")}`;

        if (visFields.length > 0 && dataFieldsAllAvailable) {
            // table changed, we need to update the rows to display
            if (table.virtual) {
                // virtual table, we need to sample the table
                fetchDisplayRows();
            } else {
                // non-virtual table, update with processed data
                const newProcessedData = createVisTableRowsLocal(table.rows);
                setVisTableRows(newProcessedData);
                setVisTableTotalRowCount(table.rows.length);
                setDataVersion(versionId);
            }
        } else {
            // If no fields, just use the table rows directly
            setVisTableRows(table.rows);
            setVisTableTotalRowCount(table.virtual?.rowCount || table.rows.length);
            setDataVersion(versionId);
        }
    }, [dataRequirements])
    


    let encodingShelfEmpty = useMemo(() => {
        return Object.keys(focusedChart.encodingMap).every(key => 
            focusedChart.encodingMap[key as keyof EncodingMap].fieldID == undefined && focusedChart.encodingMap[key as keyof EncodingMap].aggregate == undefined);
    }, [focusedChart.encodingMap]);

    // Calculate chart availability in the parent
    const chartUnavailable = useMemo(() => {
        if (focusedChart.chartType === "Auto" || focusedChart.chartType === "Table") {
            return false;
        }
        
        // Check if fields exist in table and table has rows
        return !(dataFieldsAllAvailable && table.rows.length > 0);
    }, [focusedChart.chartType, dataFieldsAllAvailable, table.rows.length]);

    let resultTable = tables.find(t => t.id == trigger?.resultTableId);

    let codeExpl = table.derive?.explanation?.code || "";
    
    let saveButton = (
        <TooltipProvider key="save-copy-tooltip">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                if (!chartUnavailable) {
                                    dispatch(dfActions.saveUnsaveChart(focusedChart.id));
                                }
                            }}
                        >
                            {focusedChart.saved ? 
                                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : 
                                <Star className="h-4 w-4" />}
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>save a copy</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    let duplicateButton = (
        <TooltipProvider key="duplicate-btn-tooltip">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            disabled={trigger != undefined}
                            onClick={() => {
                                dispatch(dfActions.duplicateChart(focusedChart.id));
                            }}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>duplicate the chart</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );


    let deleteButton = (
        <TooltipProvider key="delete-btn-tooltip">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-orange-500 hover:text-orange-600"
                            disabled={trigger != undefined}
                            onClick={() => { handleDeleteChart() }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>delete</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    let transformCode = "";
    if (table.derive?.code) {
        transformCode = `${table.derive.code}`
    }

    // Check if concepts are available
    const availableConcepts = extractConceptExplanations(table);
    const hasConcepts = availableConcepts.length > 0;

    let derivedTableItems = (resultTable?.derive || table.derive) ? [
        <div key="explanation-toggle-group" className="flex items-center mx-0.5 bg-black/[0.02] rounded p-0.5 border border-black/[0.06]">
            <div
                key="explanation-button-group"
                className="flex"
            >
                <Button 
                    key="chat-dialog-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setChatDialogOpen(!chatDialogOpen) }}
                    className={cn(
                        "text-[0.7rem] font-medium h-auto py-0.5 px-1.5 rounded-[3px]",
                        conceptExplanationsOpen 
                            ? "bg-primary/20 text-primary font-semibold hover:bg-primary/25" 
                            : "text-muted-foreground hover:bg-primary/[0.08]"
                    )}
                >
                    <MessageSquare className="h-3.5 w-3.5 mr-0.5" />
                    chat
                </Button>
                <Button 
                    key="code-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (codeViewOpen) {
                            setExplanationMode('none');
                            setCodeViewOpen(false);
                        } else {
                            setExplanationMode('code');
                            setCodeViewOpen(true);
                            setCodeExplViewOpen(false);
                            setConceptExplanationsOpen(false);
                        }
                    }}
                    className={cn(
                        "text-[0.7rem] font-medium h-auto py-0.5 px-1.5 rounded-[3px]",
                        codeViewOpen 
                            ? "bg-primary/20 text-primary font-semibold hover:bg-primary/25" 
                            : "text-muted-foreground hover:bg-primary/[0.08]"
                    )}
                >
                    <Terminal className="h-3.5 w-3.5 mr-0.5" />
                    code
                </Button>
                {codeExpl != "" && <Button 
                    key="explanation-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (codeExplViewOpen) {
                            setExplanationMode('none');
                            setCodeExplViewOpen(false);
                        } else {
                            setExplanationMode('explanation');
                            setCodeExplViewOpen(true);
                            setCodeViewOpen(false);
                            setConceptExplanationsOpen(false);
                        }
                    }}
                    className={cn(
                        "text-[0.7rem] font-medium h-auto py-0.5 px-1.5 rounded-[3px]",
                        codeExplViewOpen 
                            ? "bg-primary/20 text-primary font-semibold hover:bg-primary/25" 
                            : "text-muted-foreground hover:bg-primary/[0.08]"
                    )}
                >
                    <FileText className="h-3.5 w-3.5 mr-0.5" />
                    explain
                </Button>}
                {hasConcepts && (
                    <Button 
                        key="concepts-btn"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (conceptExplanationsOpen) {
                                setExplanationMode('none');
                                setConceptExplanationsOpen(false);
                            } else {
                                setExplanationMode('concepts');
                                setConceptExplanationsOpen(true);
                                setCodeViewOpen(false);
                                setCodeExplViewOpen(false);
                            }
                        }}
                        className={cn(
                            "text-[0.7rem] font-medium h-auto py-0.5 px-1.5 rounded-[3px]",
                            conceptExplanationsOpen 
                                ? "bg-primary/20 text-primary font-semibold hover:bg-primary/25" 
                                : "text-muted-foreground hover:bg-primary/[0.08]"
                        )}
                    >
                        <Info className="h-3.5 w-3.5 mr-0.5" />
                        concepts
                    </Button>
                )}
            </div>
        </div>,
        <ChatDialog key="chat-dialog-button" open={chatDialogOpen} 
                    handleCloseDialog={() => { setChatDialogOpen(false) }}
                    code={transformCode}
                    dialog={resultTable?.derive?.dialog || table.derive?.dialog as any[]} />
    ] : [];
    
    let chartActionButtons = [
        ...derivedTableItems,
        saveButton,
        duplicateButton,
        deleteButton,
    ]


    let chartMessage = "";
    if (focusedChart.chartType == "Table") {
        chartMessage = "Tell me what you want to visualize!";
    } else if (focusedChart.chartType == "Auto") {
        chartMessage = "Say something to get chart recommendations!";
    } else if (encodingShelfEmpty) {
        chartMessage = "Put data fields to chart builder or describe what you want!";
    } else if (chartUnavailable) {
        chartMessage = "Formulate data to create the visualization!";
    } else if (chartSynthesisInProgress.includes(focusedChart.id)) {
        chartMessage = "Synthesis in progress...";
    } else if (table.derive) {
        chartMessage = "AI generated results can be inaccurate, inspect it!";
    }

    let chartActionItems = isDataStale ? [] : (
        <div className="flex flex-col flex-1 my-1">
            {(table.virtual || table.rows.length > 5000) && !(chartUnavailable || encodingShelfEmpty) ? (
                <div className="flex flex-row m-auto justify-center items-center">
                    <span className="text-sm text-muted-foreground text-center">
                        visualizing
                    </span>
                    <SampleSizeEditor 
                        initialSize={activeVisTableRows.length}
                        totalSize={activeVisTableTotalRowCount}
                        onSampleSizeChange={(newSize) => {
                            fetchDisplayRows(newSize);
                        }}
                    />
                    <span className="text-sm text-muted-foreground text-center">
                        sample rows
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => {
                                        fetchDisplayRows(activeVisTableRows.length);
                                    }}
                                >
                                    <Dice5 className="h-3.5 w-3.5 transition-transform duration-500 ease-in-out hover:rotate-180"/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>sample again!</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            ) : ""}
            <span className="text-sm text-muted-foreground text-center">
                {chartMessage}
            </span>
        </div>
    )
    
    let codeExplComp = <div className="prose prose-sm max-w-none">
        <ReactMarkdown
            components={{
                code: ({ children }) => (
                    <code style={{ padding: "2px 4px", color: 'darkblue' }}>{children}</code>
                ),
                p: ({ children }) => (
                    <p style={{ 
                        fontFamily: "Arial, Roboto, Helvetica Neue, sans-serif",
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: 2,
                        margin: 0
                    }}>{children}</p>
                ),
                ol: ({ children }) => (
                    <ol style={{ margin: 0 }}>{children}</ol>
                ),
                li: ({ children }) => (
                    <li style={{ 
                        fontFamily: "Arial, Roboto, Helvetica Neue, sans-serif",
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: 2
                    }}>{children}</li>
                ),
            }}
        >{codeExpl}</ReactMarkdown>
    </div>

    let focusedComponent = [];

    let transformationIndicatorText = table.derive?.source ? 
        `${table.derive.source.map(s => tables.find(t => t.id === s)?.displayId || s).join(", ")} → ${table.displayId || table.id}` : "";

    let focusedElement = <div 
                            key={`fade-${focusedChart.id}-${dataVersion}-${focusedChart.chartType}-${JSON.stringify(focusedChart.encodingMap)}`} 
                            className={cn(
                                "flex flex-col flex-shrink-0 justify-center items-center chart-box transition-opacity duration-600",
                                isDataStale ? "opacity-0" : "opacity-100"
                            )}>
                                <div className="m-auto min-h-[240px] overflow-auto">
                                    <VegaChartRenderer
                                        key={focusedChart.id}
                                        chart={focusedChart}
                                        conceptShelfItems={conceptShelfItems}
                                        visTableRows={activeVisTableRows}
                                        tableMetadata={table.metadata}
                                        chartWidth={Math.round(config.defaultChartWidth * localScaleFactor)}
                                        chartHeight={Math.round(config.defaultChartHeight * localScaleFactor)}
                                        scaleFactor={1}
                                        chartUnavailable={chartUnavailable}
                                    />
                                </div>
                                {chartActionItems}
                            </div>;

    focusedComponent = [
        <div key="chart-focused-element" className="w-full min-h-[calc(100%-40px)] m-auto mt-4 mb-1 flex flex-col">
            {focusedElement}
            <div ref={explanationComponentsRef} className="w-full mx-auto">
                <Collapsible open={conceptExplanationsOpen}>
                    <CollapsibleContent>
                        <div className="min-w-[440px] max-w-[800px] px-2 relative my-2 mx-auto">
                            <ConceptExplCards 
                                concepts={extractConceptExplanations(table)}
                                title="Derived Concepts"
                                maxCards={8}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                <Collapsible open={codeViewOpen}>
                    <CollapsibleContent>
                        <div className="min-w-[440px] max-w-[960px] px-2 relative my-2 mx-auto">
                            <div className="absolute right-2 top-0.5 flex">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => {
                                        setCodeViewOpen(false);
                                        setExplanationMode('none');
                                    }} 
                                    aria-label="close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <CodeExplanationCard
                                title="Data transformation code"
                                icon={<Code className="h-4 w-4 text-primary" />}
                                transformationIndicatorText={transformationIndicatorText}
                            >
                                <div className="max-h-[400px] overflow-auto w-full p-0.5">   
                                    <CodeBox code={transformCode.trimStart()} language={table.virtual ? "sql" : "python"} />
                                </div>
                            </CodeExplanationCard>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                <Collapsible open={codeExplViewOpen}>
                    <CollapsibleContent>
                        <div className="min-w-[440px] max-w-[800px] px-2 relative my-2 mx-auto">
                            <div className="absolute right-2 top-0 flex">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => {
                                        setCodeExplViewOpen(false);
                                        setExplanationMode('none');
                                    }} 
                                    aria-label="close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <CodeExplanationCard
                                title="Data transformation explanation"
                                icon={<Terminal className="h-4 w-4 text-primary" />}
                                transformationIndicatorText={transformationIndicatorText}
                            >
                                <div className="w-fit flex flex-1">
                                    {codeExplComp}
                                </div>
                            </CodeExplanationCard>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
            <div key='chart-action-buttons' className="flex flex-shrink-0 flex-row mx-auto py-1">
                {chartActionButtons}
            </div>
        </div>
    ]
    
    let content = [
        <div key='focused-box' className="vega-focused flex overflow-auto flex-col relative">
            {focusedComponent}
        </div>,
        <EncodingShelfThread key='encoding-shelf' chartId={focusedChart.id} />
    ]

    let [scaleMin, scaleMax] = [0.2, 2.4]

    // Memoize chart resizer to avoid re-creating components on every render
    let chartResizer = useMemo(() => <div className="flex flex-row gap-2 m-1 w-40 absolute z-10 bg-white/90 rounded p-1 items-center">
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            disabled={localScaleFactor <= scaleMin} 
                            onClick={() => {
                                setLocalScaleFactor(prev => Math.max(scaleMin, prev - 0.1));
                            }}
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>zoom out</TooltipContent>
            </Tooltip>
        </TooltipProvider>
        <Slider 
            aria-label="chart-resize" 
            defaultValue={[1]} 
            step={0.1} 
            min={scaleMin} 
            max={scaleMax} 
            value={[localScaleFactor]} 
            onValueChange={(newValue) => {
                setLocalScaleFactor(newValue[0]);
            }} 
            className="flex-1"
        />
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            disabled={localScaleFactor >= scaleMax} 
                            onClick={() => {
                                setLocalScaleFactor(prev => Math.min(scaleMax, prev + 0.1));
                            }}
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>zoom in</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    </div>, [localScaleFactor]);

    return <div ref={componentRef} className="overflow-hidden flex flex-1">
        {synthesisRunning ? <div className="absolute h-full w-full z-[1001] bg-gray-100/80 flex items-center">
                <Progress value={50} className="w-full h-full opacity-5" />
            </div> : ''}
        {chartUnavailable ? "" : chartResizer}
        {content}
    </div>
}

export const VisualizationViewFC: FC<VisPanelProps> = function VisualizationView({ }) {

    let allCharts = useSelector(dfSelectors.getAllCharts);
    let focusedChartId = useSelector((state: DataFormulatorState) => state.focusedChartId);
    let focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);
    let chartSynthesisInProgress = useSelector((state: DataFormulatorState) => state.chartSynthesisInProgress);

    const dispatch = useDispatch();

    let focusedChart = allCharts.find(c => c.id == focusedChartId) as Chart;
    let synthesisRunning = focusedChartId ? chartSynthesisInProgress.includes(focusedChartId) : false;

    // when there is no result and synthesis is running, just show the waiting panel
    if (!focusedChart || focusedChart?.chartType == "?") {
        let chartSelectionBox = <div className="flex flex-row w-[666px] flex-wrap"> 
            {Object.entries(CHART_TEMPLATES)
                .flatMap(([cls, templates]) => templates.map((t, index) => ({ ...t, group: cls, index })))
                .filter(t => t.chart != "Auto")
                .map((t, globalIndex) =>
                {
                    return <Button 
                        variant="ghost"
                        disabled={synthesisRunning}
                        key={`${t.group}-${t.index}-${t.chart}-btn`}
                        className="m-0.5 p-0.5 flex flex-col normal-case justify-start h-auto"
                        onClick={() => { 
                            let focusedChart = allCharts.find(c => c.id == focusedChartId);
                            if (focusedChart?.chartType == "?") { 
                                dispatch(dfActions.updateChartType({chartType: t.chart, chartId: focusedChartId as string}));
                            } else {
                                dispatch(dfActions.createNewChart({chartType: t.chart, tableId: focusedTableId as string}));
                            }
                        }}
                    >
                        <div className={cn("w-12 h-12 flex items-center justify-center", synthesisRunning && "opacity-50")}>
                            {typeof t?.icon == 'string' ? <img height="48px" width="48px" src={t?.icon} alt="" role="presentation" /> : t.icon}
                        </div>
                        <span className="ml-0.5 whitespace-normal text-[10px] w-16">{t?.chart}</span>
                    </Button>
                }
            )}
            </div>
        return (
            <div className="m-auto">
                {focusedTableId ? <ChartRecBox className="m-auto" tableId={focusedTableId as string} placeHolderChartId={focusedChartId as string} /> : null}
                <div className="my-3 flex items-center">
                    <Separator className="flex-1" />
                    <span className="px-2 text-xs text-muted-foreground">
                        or, start with a chart type
                    </span>
                    <Separator className="flex-1" />
                </div>
                {chartSelectionBox}
            </div>
        )
    }

    let visPanel = <div className="w-full overflow-hidden flex flex-row">
        <div className="visualization-carousel contents">
            <ChartEditorFC />
        </div>
    </div>

    return visPanel;
}
