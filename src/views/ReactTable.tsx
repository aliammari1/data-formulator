// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ColumnDef {
    id: string;
    label: string;
    minWidth?: number;
    align?: 'right';
    source?: 'derived' | 'original' | 'custom';
    format?: (value: number) => string;
}

interface CustomReactTableProps {
    rows: any[];
    columnDefs: ColumnDef[];
    rowsPerPageNum: number;
    compact: boolean;
    maxCellWidth?: number;
    isIncompleteTable?: boolean;
    maxHeight?: number;
}

export const CustomReactTable: React.FC<CustomReactTableProps> = ({
    rows, columnDefs, rowsPerPageNum, compact, maxCellWidth, isIncompleteTable, maxHeight = 340 }) => {

    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(rowsPerPageNum == -1 ? (rows.length > 500 ? 100 : rows.length) : rowsPerPageNum);

    const totalPages = Math.ceil(rows.length / rowsPerPage);

    const handleChangePage = (newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    // Helper function to get background class based on column source
    const getSourceBgClass = (source?: 'derived' | 'original' | 'custom') => {
        if (source === 'derived') return 'bg-orange-500/5';
        if (source === 'custom') return 'bg-purple-500/5';
        return '';
    };

    // Helper function to get border color class based on column source
    const getBorderColorClass = (source?: 'derived' | 'original' | 'custom') => {
        if (source === 'derived') return 'border-b border-orange-500';
        if (source === 'custom') return 'border-b border-purple-500';
        return 'border-b border-primary';
    };

    const maxWidthStyle = maxCellWidth ? { maxWidth: `${maxCellWidth}px` } : { maxWidth: '60px' };

    return (
        <div className="table-container table-container-small w-full">
            <div
                className="overflow-auto"
                style={{ maxHeight: maxHeight }}
            >
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="hover:bg-transparent">
                            {columnDefs.map((column) => (
                                <TableHead
                                    key={column.id}
                                    className={cn(
                                        'text-xs text-[#333] overflow-hidden text-ellipsis whitespace-nowrap',
                                        getSourceBgClass(column.source),
                                        getBorderColorClass(column.source),
                                        column.align === 'right' && 'text-right'
                                    )}
                                    style={{ minWidth: column.minWidth, ...maxWidthStyle }}
                                >
                                    {column.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row, i) => (
                                <TableRow
                                    key={i}
                                    tabIndex={-1}
                                    className={cn(
                                        'hover:bg-muted/50',
                                        i % 2 === 0 ? 'bg-[#F0F0F0]' : ''
                                    )}
                                >
                                    {columnDefs.map((column) => {
                                        const value = row[column.id];
                                        return (
                                            <TableCell
                                                key={column.id}
                                                className={cn(
                                                    'text-[10px] overflow-hidden text-ellipsis whitespace-nowrap',
                                                    compact ? 'py-0.5 px-1' : 'p-1.5',
                                                    getSourceBgClass(column.source),
                                                    column.align === 'right' && 'text-right'
                                                )}
                                                style={maxWidthStyle}
                                            >
                                                {column.format
                                                    ? column.format(value)
                                                    : (typeof value === "boolean" ? `${value}` : value)}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        {isIncompleteTable && (
                            <TableRow>
                                {columnDefs.map((column, i) => (
                                    <TableCell key={i} className="p-0 text-left">
                                        ......
                                    </TableCell>
                                ))}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {rowsPerPage < rows.length && (
                <div className="flex items-center justify-end gap-1 py-1 text-[10px] text-gray-500">
                    <span>
                        {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, rows.length)} of {rows.length}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleChangePage(0)}
                        disabled={page === 0}
                    >
                        <ChevronFirst className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleChangePage(page - 1)}
                        disabled={page === 0}
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleChangePage(page + 1)}
                        disabled={page >= totalPages - 1}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleChangePage(totalPages - 1)}
                        disabled={page >= totalPages - 1}
                    >
                        <ChevronLast className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}