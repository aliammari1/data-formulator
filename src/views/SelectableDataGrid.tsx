// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { TableVirtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';
import { Type } from '../data/types';
import { getIconFromType } from './ViewUtils';

import _ from 'lodash';
import { FieldSource } from '../components/ComponentType';

import { Download, Cloud, Dices, ArrowUp, ArrowDown } from 'lucide-react';
import { getUrls } from '../app/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export interface ColumnDef {
    id: string;
    label: string;
    dataType: Type;
    minWidth?: number;
    width?: number;
    align?: 'right';
    format?: (value: number) => string | JSX.Element;
    source: FieldSource;
}

interface SelectableDataGridProps {
    tableId: string;
    tableName: string;
    rows: any[];
    rowCount: number;
    virtual: boolean;
    columnDefs: ColumnDef[];
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
}

function getComparator<Key extends keyof any>(
    order: "asc" | "desc",
    orderBy: Key,
): (
    a: { [key in Key]: number | string },
    b: { [key in Key]: number | string },
) => number {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}

export const SelectableDataGrid: React.FC<SelectableDataGridProps> = ({ 
    tableId, rows, tableName, columnDefs, rowCount, virtual }) => {

    const [orderBy, setOrderBy] = React.useState<string | undefined>(undefined);
    const [order, setOrder] = React.useState<'asc' | 'desc'>('asc');

    const [rowsToDisplay, setRowsToDisplay] = React.useState<any[]>(rows);
    
    // Initialize as true to cover the initial mount delay
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    
    // Clear loading state after first render
    React.useEffect(() => {
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        if (orderBy && !isLoading) {
            setRowsToDisplay(rows.slice().sort(getComparator(order, orderBy)));
        } else {
            setRowsToDisplay(rows);
        }
    }, [rows, order, orderBy])

    const TableComponents = {
        Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
            <div {...props} ref={ref} className="overflow-auto" />
        )),
        Table: (props: any) => <table {...props} className="w-full caption-bottom text-sm" />,
        TableHead: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
            <thead {...props} ref={ref} className='table-header-container [&_tr]:border-b' />
        )),
        TableRow: (props: any) => {
            const index = props['data-index'];
            return <tr {...props} className={cn(
                "border-b transition-colors",
                index % 2 === 0 ? "bg-white/5" : "bg-black/[0.02]"
            )}/>
        },
        TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
            <tbody {...props} ref={ref} className="[&_tr:last-child]:border-0" />
        )),
    }

    const fetchVirtualData = (sortByColumnIds: string[], sortOrder: 'asc' | 'desc') => {
        // Set loading to true when starting the fetch
        setIsLoading(true);

        let message = sortByColumnIds.length > 0 ? {
            table: tableId,
            size: 1000,
            method: sortOrder === 'asc' ? 'head' : 'bottom',
            order_by_fields: sortByColumnIds
        } : {
            table: tableId,
            size: 1000,
            method: 'random'
        }
        
        // Use the SAMPLE_TABLE endpoint with appropriate ordering
        fetch(getUrls().SAMPLE_TABLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                setRowsToDisplay(data.rows);
            }
            // Set loading to false when done
            setIsLoading(false);
        })
        .catch(error => {
            console.error('Error fetching sorted table data:', error);
            // Ensure loading is set to false even on error
            setIsLoading(false);
        });
    };

    return (
        <div className="table-container table-container-small w-full h-full relative [&_.table-cell]:text-xs [&_.table-cell]:max-w-[120px] [&_.table-cell]:py-0.5 [&_.table-cell]:cursor-default [&_.table-cell]:overflow-clip [&_.table-cell]:text-ellipsis [&_.table-cell]:whitespace-nowrap">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center bg-white/70 p-2 h-full rounded-t">
                    <Loader2 className="size-6 mr-2 text-gray-300 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading ...</span>
                </div>
            )}
            <div className={cn(
                "flex-1 flex flex-col transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100"
            )}>
                <TableVirtuoso
                        style={{ flex: '1 1' }}
                        data={rowsToDisplay}
                        components={TableComponents}
                        fixedHeaderContent={() => {
                    return (
                        <tr key='header-fixed' style={{ paddingRight: 0, marginRight: '17px', height: '24px'}}>
                            {columnDefs.map((columnDef, index) => {
                                const isCustomSource = columnDef.source === "custom";

                                return (
                                    <th
                                        className='data-view-header-cell table-cell p-0 text-left align-middle font-medium whitespace-nowrap'
                                        key={columnDef.id}
                                        style={{ 
                                            minWidth: columnDef.minWidth, 
                                            width: columnDef.width,
                                            textAlign: columnDef.align 
                                        }}
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div 
                                                    className={cn(
                                                        "data-view-header-container border-b-2 border-solid",
                                                        isCustomSource 
                                                            ? "bg-orange-50 border-orange-500" 
                                                            : "bg-white border-primary"
                                                    )}
                                                >
                                                    <button
                                                        className="data-view-header-title flex flex-row w-full items-center text-left hover:bg-accent/50 transition-colors px-1"
                                                        onClick={() => {
                                                            let newOrder: 'asc' | 'desc' = 'asc';
                                                            let newOrderBy : string | undefined = columnDef.id;
                                                            if (orderBy === columnDef.id && order === 'asc') {
                                                                newOrder = 'desc';
                                                            } else if (orderBy === columnDef.id && order === 'desc') {
                                                                newOrder = 'asc';
                                                                newOrderBy = undefined;
                                                            } else {
                                                                newOrder = 'asc';
                                                            }

                                                            setOrder(newOrder);
                                                            setOrderBy(newOrderBy);
                                                            
                                                            if (virtual) {
                                                                fetchVirtualData(newOrderBy ? [newOrderBy] : [], newOrder);
                                                            }
                                                        }}
                                                    >
                                                        <span role="img" className="text-inherit p-0.5 inline-flex items-center">
                                                            {getIconFromType(columnDef.dataType)}
                                                        </span>
                                                        <span className="data-view-header-name flex-1 truncate">
                                                            {columnDef.label}
                                                        </span>
                                                        {orderBy === columnDef.id && (
                                                            order === 'asc' 
                                                                ? <ArrowUp className="size-3 ml-1" />
                                                                : <ArrowDown className="size-3 ml-1" />
                                                        )}
                                                    </button>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {columnDef.label}
                                            </TooltipContent>
                                        </Tooltip>
                                    </th>
                                );
                            })}
                        </tr>
                    )
                }}
                itemContent={(rowIndex, data) => {
                    return (
                        <>
                            {columnDefs.map((column, colIndex) => {
                                const isCustomSource = column.source === "custom";

                                return (
                                    <td
                                        key={`col-${colIndex}-row-${rowIndex}`}
                                        className={cn(
                                            "table-cell p-2 align-middle whitespace-nowrap",
                                            isCustomSource ? "bg-orange-50" : "bg-white/5"
                                        )}
                                        style={{ textAlign: column.align || 'left' }}
                                    >
                                        {column.format ? column.format(data[column.id]) : data[column.id]}
                                    </td>
                                )
                            })}
                        </>
                    )
                }}
            />
            </div>
            <div className="flex flex-row absolute bottom-1.5 right-3 border rounded-md bg-background shadow-sm">
                <div className="flex items-center mx-2">
                    <span className="flex items-center text-xs">
                        {virtual && <Cloud className="size-4 mr-2"/> }
                        {`${rowCount} rows`}
                    </span>
                    {virtual && rowCount > 10000 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    size="icon-sm" 
                                    variant="ghost"
                                    className="mr-2"
                                    onClick={() => {
                                        fetchVirtualData([], 'asc');
                                    }}
                                >
                                    <Dices className="size-4 hover:rotate-180 transition-transform" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                view 10000 random rows from this table
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
}
