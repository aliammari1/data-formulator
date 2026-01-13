// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC } from 'react'
import React from 'react';

import { assembleVegaChart } from '../app/utils';
import { Chart } from '../components/ComponentType';
import { useSelector } from 'react-redux';
import { DataFormulatorState } from '../app/dfSlice';

import { createDictTable, DictTable } from '../components/ComponentType';
import { CodeBox } from './VisualizationView';
import embed from 'vega-embed';
import { CustomReactTable } from './ReactTable';

import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Trash2, Save, Database, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

export interface DerivedDataDialogProps {
    chart: Chart,
    candidateTables: DictTable[],
    open: boolean,
    handleCloseDialog: () => void,
    handleSelection: (selectIndex: number) => void,
    handleDeleteChart: () => void,
    bodyOnly?: boolean,
}

export const DerivedDataDialog: FC<DerivedDataDialogProps> = function DerivedDataDialog({ 
        chart, candidateTables, open, handleCloseDialog, handleSelection, handleDeleteChart, bodyOnly }) {

    let direction = candidateTables.length > 1 ? "horizontal" : "horizontal" ;

    let [selectionIdx, setSelectionIdx] = React.useState(0);
    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    let body = (
        <div className={cn(
            "flex overflow-x-auto mt-2.5 min-h-[50px]",
            direction === "horizontal" ? "flex-col" : "flex-row",
            "justify-between relative"
        )}>
            
            {candidateTables.map((table, idx) => {
                let code = table.derive?.code || "";
                let extTable = structuredClone(table.rows);
            
                let assembledChart: any = assembleVegaChart(chart.chartType, chart.encodingMap, conceptShelfItems, extTable, table.metadata);
                assembledChart["background"] = "transparent";

                const id = `chart-dialog-element-${idx}`;
                
                const element = (
                    <div 
                        className="vega-thumbnail-no-hover min-w-[220px] mx-auto bg-white flex justify-center cursor-pointer"
                        id={id} 
                        key={`chart-thumbnail-${idx}`} 
                        onClick={() => setSelectionIdx(idx)}
                    />
                );

                embed('#' + id, assembledChart, { actions: false, renderer: "canvas" }).then(function (result) {
                    if (result.view.container()?.getElementsByTagName("canvas")) {
                        let comp = result.view.container()?.getElementsByTagName("canvas")[0];
                        if (comp) {
                            const { width, height } = comp.getBoundingClientRect();
                            if (width > 240 || height > 180) {
                                let ratio = width / height;
                                let fixedWidth = width;
                                if (ratio * 180 < width) {
                                    fixedWidth = ratio * 180;
                                }
                                if (fixedWidth > 240) {
                                    fixedWidth = 240;
                                }
                                comp?.setAttribute("style", `max-width: 240px; max-height: 180px; width: ${Math.round(fixedWidth)}px; height: ${Math.round(fixedWidth / ratio)}px; `);
                            }
                        } else {
                            console.log("THUMB: Could not get Canvas HTML5 element")
                        }
                    }
                }).catch((reason) => {});

                let simpleTableView = (t: DictTable) => {
                    let colDefs = t.names.map(name => {
                        return {
                            id: name, label: name, minWidth: 30, align: undefined, 
                            format: (value: any) => `${value}`, source: conceptShelfItems.find(f => f.name == name)?.source
                        }
                    })
                    return (
                        <div className="relative flex flex-col">
                            <CustomReactTable rows={t.rows} columnDefs={colDefs} rowsPerPageNum={10} compact />
                        </div>
                    );
                }

                return (
                    <Card 
                        key={`candidate-dialog-${idx}`} 
                        onClick={() => setSelectionIdx(idx)} 
                        className={cn(
                            "min-w-[280px] max-w-[1920px] flex grow m-1.5 cursor-pointer transition-all duration-200",
                            selectionIdx === idx 
                                ? "border-2 border-primary ring-2 ring-primary/20" 
                                : "border hover:border-primary/50"
                        )}
                    >
                        <CardContent className="flex flex-col grow max-h-[800px] p-2">
                            <div className={cn(
                                "flex items-center gap-2 mb-2",
                                direction === "horizontal" ? "absolute" : "relative"
                            )}>
                                <div className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                    selectionIdx === idx 
                                        ? "border-primary bg-primary" 
                                        : "border-muted-foreground"
                                )}>
                                    {selectionIdx === idx && (
                                        <Check className="w-3 h-3 text-primary-foreground" />
                                    )}
                                </div>
                                <Label className={cn(
                                    "text-xs cursor-pointer",
                                    selectionIdx === idx ? "text-primary font-medium" : "text-muted-foreground"
                                )}>
                                    {`candidate-${idx+1} (${candidateTables[idx].id})`}
                                </Label>
                            </div>
                            <div className={cn(
                                "flex items-center flex-auto",
                                direction === "horizontal" ? "flex-row" : "flex-col"
                            )}>
                                <div>
                                    {element}
                                </div>
                                <div className="m-3 w-full">
                                    <div className="max-h-[300px] min-w-[200px] w-full overflow-auto grow text-xs">
                                        {simpleTableView(createDictTable(table.id, extTable))}
                                    </div>
                                </div>
                                <div className="max-w-[400px] w-fit flex max-h-[300px] overflow-visible">
                                    <CodeBox code={code} language="python" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
            
        </div>
    );

    if (bodyOnly) {
        return (
            <div className="mt-4">
                <div className="w-full flex items-center mb-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Database className="h-3.5 w-3.5" />
                        Transformation from 
                        <span className="underline font-medium text-foreground">
                            {candidateTables[0].derive?.source}
                        </span>
                    </p>
                </div>
                {body}
                <div className="w-full flex items-center justify-center gap-2 mt-4">
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteChart()}
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete all
                    </Button>
                    <Button 
                        size="sm" 
                        onClick={() => handleSelection(selectionIdx)}
                        className="gap-2"
                    >
                        <Save className="h-4 w-4" />
                        Save <span className="mx-1 px-1 bg-primary-foreground/10 rounded">
                            {`candidate ${selectionIdx + 1} (${candidateTables[selectionIdx].id})`}
                        </span> as the result
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
            <DialogContent className="max-w-[95%] max-h-[860px] min-w-[300px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Derived Data Candidates
                    </DialogTitle>
                    <DialogDescription>
                        Select the best candidate from the generated data transformations
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[600px] pr-4">
                    {body}
                </ScrollArea>
                
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleCloseDialog}>
                        Cancel
                    </Button>
                    <Button onClick={() => handleSelection(selectionIdx)} className="gap-2">
                        <Check className="h-4 w-4" />
                        Select Candidate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}