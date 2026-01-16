// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { DataFormulatorState, dfActions, dfSelectors, fetchCodeExpl, fetchFieldSemanticType, generateFreshChart } from '../app/dfSlice';

import React from 'react';

import { EncodingItem, Chart, Trigger } from "../components/ComponentType";

import _ from 'lodash';

import '../scss/EncodingShelf.scss';
import { DictTable } from "../components/ComponentType";
import { Type } from '../data/types';
import embed from 'vega-embed';

import { getTriggers, assembleVegaChart } from '../app/utils';

import { getChartTemplate } from '../components/ChartTemplates';
import { checkChartAvailability, generateChartSkeleton } from './VisualizationView';

import { Table2, Sparkles, Anchor, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

import { AppDispatch } from '../app/store';

import { EncodingShelfCard, TriggerCard } from './EncodingShelfCard';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Property and state of an encoding shelf
export interface EncodingShelfThreadProps { 
    chartId: string,
}

export let ChartElementFC: FC<{
    chart: Chart, 
    tableRows: any[], 
    tableMetadata: {[key: string]: {type: Type, semanticType: string, levels: any[]}}, 
    boxWidth?: number, boxHeight?: number}> = function({chart, tableRows, tableMetadata, boxWidth, boxHeight}) {

    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    let WIDTH = boxWidth || 120;
    let HEIGHT = boxHeight || 80;

    let chartTemplate = getChartTemplate(chart.chartType);

    let available = checkChartAvailability(chart, conceptShelfItems, tableRows);

    if (chart.chartType == "Auto") {
        return <div className="relative flex flex-col m-auto text-gray-500">
            <Sparkles className="w-9 h-9" />
        </div>
    }

    if (!available || chart.chartType == "Table") {
        return <div className="m-auto">
            {generateChartSkeleton(chartTemplate?.icon, 64, 64)}
        </div>
    } 

    // if (chart.chartType == "Table") {
    //     return renderTableChart(chart, conceptShelfItems, tableRows);
    // }

    // prepare the chart to be rendered
    let assembledChart = assembleVegaChart(chart.chartType, chart.encodingMap, conceptShelfItems, tableRows, tableMetadata, 20);
    assembledChart["background"] = "transparent";
    // chart["autosize"] = {
    //     "type": "fit",
    //     "contains": "padding"
    // };

    const id = `chart-thumbnail-${chart.id}-${(Math.random() + 1).toString(36).substring(7)}`;
    const element = <div 
        id={id} 
        className={cn("m-auto", chart.saved ? "bg-yellow-500/5" : "bg-white")}
    ></div>;

    // Temporary fix, down sample the dataset
    if (assembledChart["data"]["values"].length > 5000) {
        let values = assembledChart["data"]["values"];
        assembledChart = (({ data, ...o }) => o)(assembledChart);

        let getRandom = (seed: number) => {
            let x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        }
        let getRandomSubarray = (arr: any[], size: number) => {
            let shuffled = arr.slice(0), i = arr.length, temp, index;
            while (i--) {
                index = Math.floor((i + 1) * getRandom(233 * i + 888));
                temp = shuffled[index];
                shuffled[index] = shuffled[i];
                shuffled[i] = temp;
            }
            return shuffled.slice(0, size);
        }
        assembledChart["data"] = { "values": getRandomSubarray(values, 5000) };
    }

    assembledChart['config'] = {
        "axis": {"labelLimit": 30}
    }

    embed('#' + id, assembledChart, { actions: false, renderer: "canvas" }).then(function (result) {
        // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
        if (result.view.container()?.getElementsByTagName("canvas")) {
            let comp = result.view.container()?.getElementsByTagName("canvas")[0];

            // Doesn't seem like width & height are actual numbers here on Edge bug
            // let width = parseInt(comp?.style.width as string);
            // let height = parseInt(comp?.style.height as string);
            if (comp) {
                const { width, height } = comp.getBoundingClientRect();
                //console.log(`THUMB: width = ${width} height = ${height}`);

                if (width > WIDTH || height > HEIGHT) {
                    let ratio = width / height;
                    let fixedWidth = width;
                    if (ratio * HEIGHT < width) {
                        fixedWidth = ratio * HEIGHT;
                    }
                    if (fixedWidth > WIDTH) {
                        fixedWidth = WIDTH;
                    }
                    //console.log("THUMB: width or height are oversized");
                    //console.log(`THUMB: new width = ${fixedWidth}px height = ${fixedWidth / ratio}px`)
                    comp?.setAttribute("style", 
                        `max-width: ${WIDTH}px; max-height: ${HEIGHT}px; width: ${Math.round(fixedWidth)}px; height: ${Math.round(fixedWidth / ratio)}px; `);
                }
            } else {
                console.log("THUMB: Could not get Canvas HTML5 element")
            }
        }
    }).catch((reason) => {
        // console.log(reason)
        // console.error(reason)
    });

    return element;
}

export const EncodingShelfThread: FC<EncodingShelfThreadProps> = function ({ chartId }) {

    const [collapseEditor, setCollapseEditor] = useState(false);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    let allCharts = useSelector(dfSelectors.getAllCharts);

    let chart = allCharts.find(c => c.id == chartId) as Chart;
    let chartTrigger = chart.source == "trigger" ? tables.find(t => t.derive?.trigger?.chart?.id == chartId)?.derive?.trigger : undefined;

    let t = tables.find(t => t.id == chart.tableRef) as DictTable;
    let activeTableThread = [...getTriggers(t, tables).map(tr => tr.tableId), chart.tableRef];
    
    const dispatch = useDispatch<AppDispatch>();

    const interleaveArrays: any = (a: any[], b: any[], spaceElement?: any) => a.length ? [a[0], spaceElement || '',...interleaveArrays(b, a.slice(1), spaceElement)] : b;

    let previousInstructions : any = ""

    let buildTableCard = (tableId: string) => {
        let table = tables.find(t => t.id == tableId) as DictTable;
        return <div
                key={`${tableId}-table-list-item`}
                className="table-list-item">
                <Button 
                    variant="ghost" 
                    className="p-0 min-w-0 h-auto text-primary hover:bg-transparent"
                    onClick={() => { dispatch(dfActions.setFocusedTable(tableId)) }}
                >
                <div className="flex flex-row items-center gap-0.5 text-xs">
                    {table && table.anchored ? <Anchor className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
                    <span className="text-xs">
                        {table.displayId || tableId}
                    </span>
                </div>
            </Button>
        </div>
    }

    let tableList = activeTableThread.map((tableId) => {
        let table = tables.find(t => t.id == tableId) as DictTable;
        if (!table) {
            return null;
        }
        return buildTableCard(tableId);
    });

    let leafTable = tables.find(t => t.id == activeTableThread[activeTableThread.length - 1]) as DictTable;

    let triggers =  getTriggers(leafTable, tables)

    let instructionCards = triggers.map((trigger, i) => {
        let extractActiveFields = (t: Trigger) => {
            let encodingMap = allCharts.find(c => c.id == t.chart?.id)?.encodingMap;
            if (!encodingMap) {
                return [];
            }
            return Array.from(Object.values(encodingMap)).map((enc: EncodingItem) => enc.fieldID).filter(x => x != undefined)
        };
        let previousActiveFields = new Set(i == 0 ? [] : extractActiveFields(triggers[i - 1]))
        let currentActiveFields = new Set(extractActiveFields(trigger))
        let fieldsIdentical = _.isEqual(previousActiveFields, currentActiveFields)
        return <div 
            key={`${trigger.tableId}-trigger-card`}
            className="p-0 flex flex-col">
            <div className="ml-2 h-1 border-l border-gray-300"></div>

            <TriggerCard 
                className="encoding-shelf-trigger-card" 
                trigger={trigger} 
                hideFields={trigger.instruction != ""} 
                mini={true} />
            <div className="ml-2 h-1 border-l border-gray-600"></div>
        </div>
    })
    
    let spaceElement = "" //<div className="py-1 bg-blue-50 mx-auto w-[200px] h-[3px] pb-0.5"></div>;

    let truncated = tableList.length > 3;

    previousInstructions = truncated ? 
        <div className="py-1 flex flex-col">
            {tableList[0]}
            <div className="h-6 border-l border-dashed border-gray-600 relative ml-2 flex items-center cursor-pointer hover:ml-[7px] hover:border-l-[3px] hover:border-solid hover:border-gray-600">
                <span className="text-xs text-gray-500 ml-2">
                    ...
                </span>
            </div>
            {tableList[tableList.length - 3]}
            {instructionCards[instructionCards.length - 2]}
            {tableList[tableList.length - 2]}
            {instructionCards[instructionCards.length - 1]}
            {tableList[tableList.length - 1]}
        </div> 
    :
        <div className="py-1 flex flex-col">
            {interleaveArrays(tableList, instructionCards, spaceElement)}
        </div>;

    let postInstruction : any = "";
    if (chartTrigger) {
        
        let resultTable = tables.find(t => t.id == chartTrigger.resultTableId) as DictTable;
        let leafUserCharts = allCharts.filter(c => c.tableRef == resultTable.id).filter(c => c.source == "user");

        let endChartCards = leafUserCharts.map((c) => {
            return <Card 
                key={c.id}
                className="hover-card p-0.5 flex items-start w-fit cursor-pointer [&_canvas]:m-px"
                onClick={() => { 
                    dispatch(dfActions.setFocusedChart(c.id));
                    dispatch(dfActions.setFocusedTable(c.tableRef));
                }}
            >
                <ChartElementFC chart={c} tableRows={resultTable.rows.slice(0, 100)} tableMetadata={resultTable.metadata} boxWidth={200} boxHeight={160}/>
            </Card>
        })

        postInstruction = <Collapsible open={true} className="w-full">
            <CollapsibleContent>
                <div key="post-instruction" className="w-[17px] h-3">
                    <div 
                        className="p-0 w-px mx-auto h-full"
                        style={{
                            backgroundImage: 'linear-gradient(180deg, darkgray, darkgray 75%, transparent 75%, transparent 100%)',
                            backgroundSize: '1px 6px, 3px 100%'
                        }}
                    ></div>
                </div>
                {buildTableCard(resultTable.id)}
                <div key="post-instruction-2" className="w-[17px] h-3">
                    <div 
                        className="p-0 w-px mx-auto h-full"
                        style={{
                            backgroundImage: 'linear-gradient(180deg, darkgray, darkgray 75%, transparent 75%, transparent 100%)',
                            backgroundSize: '1px 6px, 3px 100%'
                        }}
                    ></div>
                </div>
                <div className="flex flex-col gap-1">
                    {endChartCards}
                </div>
            </CollapsibleContent>
        </Collapsible>
    }

    const encodingShelf = (
        <div 
            className="encoding-shelf-compact h-full w-[236px] overflow-y-auto transition-[height] duration-300 ease-in-out items-start pr-2"
        >
             {[   
                <div
                    key="encoding-shelf" 
                    className="flex"
                > 
                    {previousInstructions}
                </div>,
            ]}
            <div className="w-[17px] h-3">
                <div 
                    className="p-0 w-px mx-auto h-full"
                    style={{
                        backgroundImage: 'linear-gradient(180deg, darkgray, darkgray 75%, transparent 75%, transparent 100%)',
                        backgroundSize: '1px 6px, 3px 100%'
                    }}
                ></div>
            </div>
            <EncodingShelfCard chartId={chartId}/>
            {postInstruction}
            <div className="h-3"></div>
        </div>
    )

    return <div 
        key='encoding-shelf'
        className={cn(
            "relative transition-all duration-300 ease-in-out overflow-hidden",
            collapseEditor ? "w-16" : "w-auto"
        )}
        style={{
            position: 'relative',
        }}
    >
        <div 
            className={cn(
                "relative",
                collapseEditor && "after:content-[''] after:absolute after:top-0 after:right-0 after:w-5 after:h-full after:bg-gradient-to-r after:from-transparent after:to-white after:pointer-events-none after:z-10"
            )}
        >
            <div className="flex flex-row h-full relative">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost"
                            className="w-[18px] min-w-[18px] p-0 text-primary"
                            onClick={()=>{setCollapseEditor(!collapseEditor)}}
                        >
                            {collapseEditor ? <ChevronLeft className="w-[18px] h-[18px]" /> : <ChevronRight className="w-[18px] h-[18px]" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        {collapseEditor ? "open editor" : "hide editor"}
                    </TooltipContent>
                </Tooltip>
                {encodingShelf}
            </div>
        </div>
    </div>;
}
