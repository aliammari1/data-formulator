// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useState, useRef, useEffect, memo, useMemo } from 'react';
import { ArrowRight, ArrowLeft, FileText, Pencil, HelpCircle, History, Trash2, Share2, CheckCircle, ChevronDown, ChevronUp, TableIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions, dfSelectors, GeneratedReport } from '../app/dfSlice';
import { Message } from './MessageSnackbar';
import { getUrls, assembleVegaChart, getTriggers, prepVisTable } from '../app/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import embed from 'vega-embed';
import { getDataTable } from './VisualizationView';
import { DictTable } from '../components/ComponentType';
import { AppDispatch } from '../app/store';
import { convertToChartifact, openChartifactViewer } from './ChartifactDialog';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Simple spinner component
const Spinner: FC<{ className?: string }> = ({ className }) => (
    <div className={cn("animate-spin rounded-full border-2 border-current border-t-transparent", className)} />
);

// Typography constants
const FONT_FAMILY_SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"';
const FONT_FAMILY_SERIF = 'Georgia, Cambria, "Times New Roman", Times, serif';
const FONT_FAMILY_MONO = '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// Color constants
const COLOR_HEADING = 'rgb(37, 37, 37)';
const COLOR_BODY = 'rgb(55, 53, 47)';
const COLOR_MUTED = 'rgb(73, 73, 73)';
const COLOR_BG_LIGHT = 'rgba(247, 246, 243, 1)';

// Social post style constants (Twitter/X style)
const COLOR_SOCIAL_TEXT = 'rgb(15, 20, 25)';
const COLOR_SOCIAL_BORDER = 'rgb(207, 217, 222)';
const COLOR_SOCIAL_ACCENT = 'rgb(29, 155, 240)';

// Executive summary style constants (professional/business look)
const COLOR_EXEC_TEXT = 'rgb(33, 37, 41)';
const COLOR_EXEC_HEADING = 'rgb(20, 24, 28)';
const COLOR_EXEC_BORDER = 'rgb(108, 117, 125)';
const COLOR_EXEC_ACCENT = 'rgb(0, 123, 255)';
const COLOR_EXEC_BG = 'rgb(248, 249, 250)';

// Markdown component styles using Tailwind classes
const getMarkdownComponents = (style: string) => {
    const isNotionStyle = style === 'blog post';
    const isSocialStyle = style === 'social post' || style === 'short note';
    const isExecStyle = style === 'executive summary';

    return {
        h1: ({ children }: any) => (
            <h1 className={cn(
                "font-bold tracking-tight",
                isNotionStyle && "text-2xl leading-tight -tracking-wide pb-1 mb-6 mt-8",
                isSocialStyle && "text-lg leading-tight font-bold mb-3 mt-3",
                isExecStyle && "text-xl leading-tight font-bold mb-4 mt-5"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_HEADING : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_HEADING 
            }}>{children}</h1>
        ),
        h2: ({ children }: any) => (
            <h2 className={cn(
                "font-bold",
                isNotionStyle && "text-xl leading-snug pb-1 mb-5 mt-7",
                isSocialStyle && "text-base leading-tight font-bold mb-2.5 mt-3",
                isExecStyle && "text-lg leading-snug font-semibold mb-3 mt-4"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_HEADING : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_HEADING 
            }}>{children}</h2>
        ),
        h3: ({ children }: any) => (
            <h3 className={cn(
                "font-semibold",
                isNotionStyle && "text-lg leading-normal mb-4 mt-6",
                isSocialStyle && "text-sm leading-snug font-semibold mb-2 mt-2.5",
                isExecStyle && "text-base leading-normal font-semibold mb-2.5 mt-3"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_HEADING : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_HEADING 
            }}>{children}</h3>
        ),
        h4: ({ children }: any) => (
            <h4 className={cn(
                "font-semibold",
                isNotionStyle && "text-base leading-normal mb-3 mt-5",
                isSocialStyle && "text-sm leading-snug font-semibold mb-2 mt-2",
                isExecStyle && "text-sm leading-normal font-semibold mb-2 mt-3"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_HEADING : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_HEADING 
            }}>{children}</h4>
        ),
        p: ({ children }: any) => (
            <p className={cn(
                isNotionStyle && "text-sm leading-7 mb-3.5",
                isSocialStyle && "text-sm leading-relaxed mb-1.5",
                isExecStyle && "text-sm leading-relaxed mb-2.5 text-justify"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_TEXT : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_BODY 
            }}>{children}</p>
        ),
        a: ({ href, children }: any) => (
            <a 
                href={href} 
                className="text-blue-600 hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
            >{children}</a>
        ),
        ul: ({ children }: any) => (
            <ul className={cn(
                "list-disc",
                isNotionStyle && "pl-7 mt-1.5 mb-3",
                isSocialStyle && "pl-6 mt-1 mb-2",
                isExecStyle && "pl-6 mt-1 mb-2"
            )} style={{ fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM }}>{children}</ul>
        ),
        ol: ({ children }: any) => (
            <ol className={cn(
                "list-decimal",
                isNotionStyle && "pl-7 mt-1.5 mb-3",
                isSocialStyle && "pl-6 mt-1 mb-2",
                isExecStyle && "pl-6 mt-1 mb-2"
            )} style={{ fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM }}>{children}</ol>
        ),
        li: ({ children }: any) => (
            <li className={cn(
                isNotionStyle && "text-sm leading-7 mb-1",
                isSocialStyle && "text-sm leading-relaxed mb-0.5",
                isExecStyle && "text-sm leading-relaxed mb-0.5"
            )} style={{ 
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                color: isExecStyle ? COLOR_EXEC_TEXT : isSocialStyle ? COLOR_SOCIAL_TEXT : COLOR_BODY 
            }}>{children}</li>
        ),
        blockquote: ({ children }: any) => (
            <blockquote className={cn(
                "border-l-[3px] pl-5 py-2 my-5 italic",
                isExecStyle && "border-l-2 pl-4 py-2 my-3"
            )} style={{ 
                borderColor: isExecStyle ? COLOR_EXEC_ACCENT : 'rgba(0, 0, 0, 0.15)',
                fontFamily: isExecStyle ? FONT_FAMILY_SERIF : FONT_FAMILY_SERIF,
                color: isExecStyle ? COLOR_EXEC_TEXT : COLOR_MUTED,
                backgroundColor: isExecStyle ? COLOR_EXEC_BG : 'transparent'
            }}>{children}</blockquote>
        ),
        pre: ({ children }: any) => (
            <pre className={cn(
                "p-4 rounded overflow-auto my-4 border",
                isExecStyle && "p-3 my-3"
            )} style={{ 
                backgroundColor: isExecStyle ? COLOR_EXEC_BG : COLOR_BG_LIGHT,
                borderColor: 'rgba(0, 0, 0, 0.08)'
            }}>{children}</pre>
        ),
        code: ({ children }: any) => (
            <code className={cn(
                "px-1 py-0.5 rounded text-sm font-medium"
            )} style={{ 
                fontFamily: FONT_FAMILY_MONO,
                backgroundColor: isSocialStyle ? `${COLOR_SOCIAL_ACCENT}1A` : isExecStyle ? COLOR_EXEC_BG : 'rgba(135, 131, 120, 0.15)',
                color: isSocialStyle ? COLOR_SOCIAL_ACCENT : isExecStyle ? COLOR_EXEC_ACCENT : '#eb5757'
            }}>{children}</code>
        ),
        table: ({ children }: any) => (
            <div className="my-4 border rounded overflow-hidden">
                <Table>{children}</Table>
            </div>
        ),
        thead: ({ children }: any) => (
            <TableHeader style={{ backgroundColor: COLOR_BG_LIGHT }}>{children}</TableHeader>
        ),
        tbody: ({ children }: any) => (
            <TableBody>{children}</TableBody>
        ),
        tr: ({ children }: any) => (
            <TableRow>{children}</TableRow>
        ),
        th: ({ children }: any) => (
            <TableHead className="font-semibold border-b-2 py-3 px-4 text-sm" style={{ fontFamily: FONT_FAMILY_SYSTEM }}>{children}</TableHead>
        ),
        td: ({ children }: any) => (
            <TableCell className="py-3 px-4 border-b text-sm leading-relaxed" style={{ fontFamily: FONT_FAMILY_SYSTEM }}>{children}</TableCell>
        ),
        hr: () => (
            <Separator className="my-6" />
        ),
        img: ({ src, alt }: any) => (
            <img 
                src={src} 
                alt={alt || ''} 
                className={cn(
                    "object-contain",
                    isSocialStyle && "w-full max-w-full h-auto max-h-[280px] rounded-lg my-2",
                    isExecStyle && "max-w-[70%] h-auto rounded my-4",
                    isNotionStyle && "max-w-[75%] h-auto rounded my-7"
                )}
            />
        ),
    };
};

export const ReportView: FC = () => {
    // Get all generated reports from Redux state
    const dispatch = useDispatch<AppDispatch>();

    const charts = useSelector((state: DataFormulatorState) => state.charts);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const selectedModelId = useSelector((state: DataFormulatorState) => state.selectedModelId);
    const models = useSelector((state: DataFormulatorState) => state.models);
    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);
    const config = useSelector((state: DataFormulatorState) => state.config);
    const allGeneratedReports = useSelector(dfSelectors.getAllGeneratedReports);
    const focusedChartId = useSelector((state: DataFormulatorState) => state.focusedChartId);

    const [selectedChartIds, setSelectedChartIds] = useState<Set<string>>(new Set(focusedChartId ? [focusedChartId] : []));
    const [previewImages, setPreviewImages] = useState<Map<string, { url: string; width: number; height: number }>>(new Map());
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string>('');
    const [style, setStyle] = useState<string>('short note');
    const [mode, setMode] = useState<'compose' | 'post'>(allGeneratedReports.length > 0 ? 'post' : 'compose');

    // Local state for current report
    const [currentReportId, setCurrentReportId] = useState<string | undefined>(undefined);
    const [generatedReport, setGeneratedReport] = useState<string>('');
    const [generatedStyle, setGeneratedStyle] = useState<string>('short note');
    const [cachedReportImages, setCachedReportImages] = useState<Record<string, { url: string; width: number; height: number }>>({});
    const [shareButtonSuccess, setShareButtonSuccess] = useState(false);
    const [hideTableOfContents, setHideTableOfContents] = useState(false);

    const updateCachedReportImages = (chartId: string, blobUrl: string, width: number, height: number) => {
        setCachedReportImages(prev => ({
            ...prev,
            [chartId]: { url: blobUrl, width, height }
        }));
    };

    // Helper function to show messages using dfSlice
    const showMessage = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        const msg: Message = {
            type,
            component: 'ReportView',
            timestamp: Date.now(),
            value: message
        };
        dispatch(dfActions.addMessages(msg));
    };

    // Function to capture and share report as image
    const shareReportAsImage = async () => {
        if (!currentReportId) return;

        try {
            // Find the report content element
            const reportElement = document.querySelector('[data-report-content]') as HTMLElement;
            if (!reportElement) {
                showMessage('Could not find report content to capture', 'error');
                return;
            }

            // Capture the report as canvas with extra padding for borders
            const canvas = await html2canvas(reportElement, {
                backgroundColor: '#ffffff',
                scale: 2, // Higher quality
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                // Add extra padding to ensure borders are captured
                width: reportElement.scrollWidth + 4,
                height: reportElement.scrollHeight + 4,
                logging: false // Disable console logs
            });

            // Convert canvas to blob
            canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                    showMessage('Failed to generate image', 'error');
                    return;
                }

                // Copy to clipboard
                if (navigator.clipboard && navigator.clipboard.write) {
                    navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]).then(() => {
                        showMessage('Report image copied to clipboard! You can now paste it anywhere to share.');
                        setShareButtonSuccess(true);
                        setTimeout(() => setShareButtonSuccess(false), 2000);
                    }).catch(() => {
                        showMessage('Failed to copy to clipboard. Your browser may not support this feature.', 'error');
                    });
                } else {
                    showMessage('Clipboard API not supported in your browser. Please use a modern browser.', 'error');
                }
            }, 'image/png', 0.95);

        } catch (error) {
            console.error('Error generating report image:', error);
            showMessage('Failed to generate report image. Please try again.', 'error');
        }
    };



    // Update like this:
    const processReport = (rawReport: string): string => {
        const markdownMatch = rawReport.match(/```markdown\n([\s\S]*?)(?:\n```)?$/);
        let processed = markdownMatch ? markdownMatch[1] : rawReport;
        
        Object.entries(cachedReportImages).forEach(([chartId, { url, width, height }]) => {
            processed = processed.replace(
                new RegExp(`\\[IMAGE\\(${chartId}\\)\\]`, 'g'),
                `<img src="${url}" alt="Chart" width="${width}" height="${height}" />`
            );
        });
        
        return processed;
    };

    const loadReport = (reportId: string) => {
        const report = allGeneratedReports.find(r => r.id === reportId);
        if (report) {
            setCurrentReportId(reportId);
            setGeneratedReport(report.content);
            setGeneratedStyle(report.style);

            // load / assemble chart images for the report
            report.selectedChartIds.forEach((chartId) => {
                const chart = charts.find(c => c.id === chartId);
                if (!chart) return null;

                const chartTable = tables.find(t => t.id === chart.tableRef);
                if (!chartTable) return null;

                if (chart.chartType === 'Table' || chart.chartType === '?') {
                    return null;
                }
                getChartImageFromVega(chart, chartTable).then(({ blobUrl, width, height }) => {
                    if (blobUrl) {
                        // Use blob URL for local display and caching
                        updateCachedReportImages(chart.id, blobUrl, width, height);
                    }
                });
            });
        }
    };

    useEffect(() => {
        if (currentReportId === undefined && allGeneratedReports.length > 0) {
            loadReport(allGeneratedReports[0].id);
        }
    }, [currentReportId]);


    
    // Sort charts based on data thread ordering
    const sortedCharts = useMemo(() => {
        // Create table order mapping (anchored tables get higher order)
        const tableOrder = Object.fromEntries(
            tables.map((table, index) => [
                table.id, 
                index + (table.anchored ? 1 : 0) * tables.length
            ])
        );
        
        // Get ancestor orders for a table
        const getAncestorOrders = (table: DictTable): number[] => {
            const triggers = getTriggers(table, tables);
            return [...triggers.map(t => tableOrder[t.tableId]), tableOrder[table.id]];
        };
        
        // Sort charts by their associated table's ancestor orders
        return [...charts].sort((chartA, chartB) => {
            const tableA = getDataTable(chartA, tables, charts, conceptShelfItems);
            const tableB = getDataTable(chartB, tables, charts, conceptShelfItems);
            
            const ordersA = getAncestorOrders(tableA);
            const ordersB = getAncestorOrders(tableB);
            
            // Compare orders element by element
            for (let i = 0; i < Math.min(ordersA.length, ordersB.length); i++) {
                if (ordersA[i] !== ordersB[i]) {
                    return ordersA[i] - ordersB[i];
                }
            }
            
            // If all orders are equal, compare by length
            return ordersA.length - ordersB.length;
        });
    }, [charts, tables, conceptShelfItems]);

    // Clean up Blob URLs on unmount
    useEffect(() => {
        return () => {
            // Clean up preview images (these are always blob URLs)
            previewImages.forEach(({ url }) => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, []); // Only cleanup on unmount, not when images change

    // Generate preview images for all charts
    useEffect(() => {
        const generatePreviews = async () => {
            setIsLoadingPreviews(true);
            const newPreviewImages = new Map<string, { url: string; width: number; height: number }>();

            // Clean up old preview images
            previewImages.forEach(({ url }) => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });

            await Promise.all(
                sortedCharts.map(async (chart) => {
                    try {
                        const chartTable = tables.find(t => t.id === chart.tableRef);
                        if (!chartTable || chart.chartType === 'Table' || chart.chartType === '?' || chart.chartType === 'Auto') {
                            return;
                        }

                        const { blobUrl, width, height } = await getChartImageFromVega(chart, chartTable);
                        if (blobUrl) {
                            newPreviewImages.set(chart.id, { url: blobUrl, width, height });
                        }
                    } catch (error) {
                        console.warn(`Failed to generate preview for chart ${chart.id}:`, error);
                    }
                })
            );

            setPreviewImages(newPreviewImages);
            setIsLoadingPreviews(false);
        };

        if (sortedCharts.length > 0) {
            generatePreviews();
        }
    }, [sortedCharts, tables, conceptShelfItems, config]);

    const toggleChartSelection = (chartId: string) => {
        const newSelection = new Set(selectedChartIds);
        if (newSelection.has(chartId)) {
            newSelection.delete(chartId);
        } else {
            newSelection.add(chartId);
        }
        setSelectedChartIds(newSelection);
    };

    const selectAll = () => {
        // Only select available charts (excluding Table, ?, Auto, and charts without preview images)
        const availableChartIds = sortedCharts
            .filter(chart => {
                const isUnavailable = chart.chartType === 'Table' || 
                                      chart.chartType === '?' || 
                                      chart.chartType === 'Auto';
                const hasPreview = previewImages.has(chart.id);
                return !isUnavailable && hasPreview;
            })
            .map(c => c.id);
        setSelectedChartIds(new Set(availableChartIds));
    };

    const deselectAll = () => {
        setSelectedChartIds(new Set());
    };

    const getChartImageFromVega = async (chart: any, chartTable: any): Promise<{ dataUrl: string; blobUrl: string; width: number; height: number }> => {
        try {
            // Preprocess the data for aggregations
            const processedRows = prepVisTable(chartTable.rows, conceptShelfItems, chart.encodingMap);
            
            // Assemble the Vega spec
            const assembledChart = assembleVegaChart(
                chart.chartType,
                chart.encodingMap,
                conceptShelfItems,
                processedRows,
                chartTable.metadata,
                30,
                true,
                config.defaultChartWidth,
                config.defaultChartHeight,
                true
            );

            // Create a temporary container for embedding
            const tempId = `temp-chart-${chart.id}-${Date.now()}`;
            const tempDiv = document.createElement('div');
            tempDiv.id = tempId;
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            document.body.appendChild(tempDiv);

            try {
                // Embed the chart
                const result = await embed(`#${tempId}`, assembledChart, { 
                    actions: false,
                    renderer: 'svg'
                });

                // Export to SVG with high resolution
                const svgString = await result.view.toSVG(4);
                
                // Parse SVG to get original dimensions
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');
                
                if (!svgElement) {
                    throw new Error('Could not parse SVG');
                }
                
                // Get original dimensions
                const originalWidth = parseFloat(svgElement.getAttribute('width') || '0');
                const originalHeight = parseFloat(svgElement.getAttribute('height') || '0');
                
                // Convert SVG to PNG using canvas
                const { dataUrl, blobUrl } = await new Promise<{ dataUrl: string; blobUrl: string }>((resolve, reject) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    const img = new Image();
                    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                    const svgUrl = URL.createObjectURL(svgBlob);

                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(svgUrl);
                        
                        const dataUrl = canvas.toDataURL('image/png');
                        
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const blobUrl = URL.createObjectURL(blob);
                                resolve({ dataUrl, blobUrl });
                            } else {
                                resolve({ dataUrl, blobUrl: '' });
                            }
                        }, 'image/png');
                    };

                    img.onerror = (err) => {
                        URL.revokeObjectURL(svgUrl);
                        reject(err);
                    };

                    img.src = svgUrl;
                });

                document.body.removeChild(tempDiv);

                return { dataUrl, blobUrl, width: originalWidth, height: originalHeight };
            } catch (error) {
                if (document.body.contains(tempDiv)) {
                    document.body.removeChild(tempDiv);
                }
                throw error;
            }
        } catch (e) {
            console.warn('Could not capture chart image:', e);
            return { dataUrl: '', blobUrl: '', width: 0, height: 0 };
        }
    };

    const generateReport = async () => {
        if (selectedChartIds.size === 0) {
            setError('Please select at least one chart');
            return;
        }

        setIsGenerating(true);
        setError('');
        setGeneratedReport('');
        setGeneratedStyle(style);

        // Create a new report ID
        const reportId = `report-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        try {
            let model = models.find(m => m.id == selectedModelId);

            if (!model) {
                throw new Error('No model selected');
            }

            const inputTables = tables.filter(t => t.anchored).map(table => ({
                name: table.id,
                rows: table.rows,
                attached_metadata: table.attachedMetadata
            }));


            const selectedCharts = await Promise.all(
                sortedCharts
                .filter(chart => selectedChartIds.has(chart.id))
                .map(async (chart) => {

                    const chartTable = tables.find(t => t.id === chart.tableRef);
                    if (!chartTable) return null;

                    if (chart.chartType === 'Table' || chart.chartType === '?') {
                        return null;
                    }

                    const { dataUrl, blobUrl, width, height } = await getChartImageFromVega(chart, chartTable);

                    if (blobUrl) {
                        // Use blob URL for local display and caching
                        updateCachedReportImages(chart.id, blobUrl, width, height);
                    }

                    return {
                        chart_id: chart.id,
                        code: chartTable.derive?.code || '',
                        chart_data: {
                            name: chartTable.id,
                            rows: chartTable.rows
                        },
                        chart_url: dataUrl // use data_url to send to the agent
                    };
                })
            );

            const validCharts = selectedCharts.filter(c => c !== null);

            const requestBody = {
                model: model,
                input_tables: inputTables,
                charts: validCharts,
                style: style,
                language: tables.some(t => t.virtual) ? "sql" : "python"
            };

            const response = await fetch(getUrls().GENERATE_REPORT_STREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let accumulatedReport = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Create the report object for saving to Redux
                    const report: GeneratedReport = {
                        id: reportId,
                        content: accumulatedReport,
                        style: style,
                        selectedChartIds: Array.from(selectedChartIds),
                        createdAt: Date.now(),
                    };
                    // Save to Redux state
                    dispatch(dfActions.saveGeneratedReport(report));
                    break;
                };

                const chunk = decoder.decode(value, { stream: true });
                
                if (chunk.startsWith('error:')) {
                    const errorData = JSON.parse(chunk.substring(6));
                    throw new Error(errorData.content || 'Error generating report');
                }

                accumulatedReport += chunk;

                // Update local state
                setGeneratedReport(accumulatedReport);
                setCurrentReportId(reportId);
                
                if (mode === 'compose') {
                    setMode('post');
                }
            }

        } catch (err) {
            setError((err as Error).message || 'Failed to generate report');
        } finally {
            setIsGenerating(false);
        }
    };


    const deleteReport = (reportId: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent triggering the card click
        dispatch(dfActions.deleteGeneratedReport(reportId));
        
        // If we're deleting the currently viewed report, switch to another report or clear the view
        if (currentReportId === reportId) {
            const remainingReports = allGeneratedReports.filter(r => r.id !== reportId);
            if (remainingReports.length > 0) {
                // Switch to the first remaining report
                loadReport(remainingReports[0].id);
            } else {
                // No reports left, clear the view and go back to compose mode
                setCurrentReportId(undefined);
                setGeneratedReport('');
                setGeneratedStyle('short note');
                setMode('compose');
            }
        }
    };

    let displayedReport = isGenerating ? 
        `${generatedReport} <span class="pencil" style="opacity: 0.4; margin-left: 2px;">✏️</span>` : generatedReport;
    displayedReport = processReport(displayedReport);

    return (
        <TooltipProvider>
        <div className="h-full w-full flex flex-col overflow-hidden">
            {mode === 'compose' ? (
                <div className="overflow-y-auto relative h-full">
                    <div className="p-4 pb-0 flex">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dispatch(dfActions.setViewMode('editor'))}
                            className="text-muted-foreground"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            back to explore
                        </Button>
                        <Separator orientation="vertical" className="mx-2 h-6" />
                        <Button
                            variant="ghost"
                            disabled={allGeneratedReports.length === 0}
                            size="sm"
                            onClick={() => setMode('post')}
                        >
                            view reports
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                    {/* Centered Top Bar */}
                    <div className="flex justify-center p-4">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/90 backdrop-blur-md border border-black/[0.08] shadow-sm hover:bg-white/95 hover:border-black/[0.12] hover:shadow-md transition-all duration-200">
                            {/* Natural Flow */}
                            <span className="text-sm font-medium text-foreground">
                                Create a
                            </span>
                            
                            <ToggleGroup
                                type="single"
                                value={style}
                                onValueChange={(newStyle) => newStyle && setStyle(newStyle)}
                                className="gap-0.5"
                            >
                                {[
                                    { value: 'short note', label: 'short note' },
                                    { value: 'blog post', label: 'blog post' },
                                    { value: 'social post', label: 'social post' },
                                    { value: 'executive summary', label: 'executive summary' },
                                ].map((option) => (
                                    <ToggleGroupItem 
                                        key={option.value}
                                        value={option.value}
                                        className="px-2 py-0.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                    >
                                        {option.label}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>

                            <span className="text-sm font-medium text-foreground">
                                from
                            </span>
                            
                            <span className={cn(
                                "text-sm font-bold",
                                selectedChartIds.size === 0 ? "text-yellow-600" : "text-primary"
                            )}>
                                {selectedChartIds.size}
                            </span>
                            
                            <span className="text-sm font-medium text-foreground">
                                {selectedChartIds.size <= 1 ? 'chart' : 'charts'}
                            </span>

                            {/* Generate Button */}
                            <Button
                                disabled={isGenerating || selectedChartIds.size === 0}
                                onClick={generateReport}
                                size="sm"
                                className="ml-4"
                            >
                                {isGenerating ? (
                                    <Spinner className="w-3.5 h-3.5 mr-1.5" />
                                ) : (
                                    <Pencil className="w-4 h-4 mr-1.5" />
                                )}
                                {isGenerating ? 'composing...' : 'compose'}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="py-4 px-12">
                        {error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertDescription className="flex items-center justify-between">
                                    {error}
                                    <button onClick={() => setError('')} className="ml-2 text-sm underline">Dismiss</button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {sortedCharts.length === 0 ? (
                            <p className="text-muted-foreground">
                                No charts available. Create some visualizations first.
                            </p>
                        ) : isLoadingPreviews ? (
                            <div className="flex items-center justify-center py-8">
                                <Spinner className="w-4 h-4 text-muted-foreground" />
                                <span className="ml-3 text-muted-foreground">
                                    loading chart previews...
                                </span>
                            </div>
                        ) : (() => {
                            // Filter out unavailable charts (Table, ?, Auto, and charts without preview images)
                            const availableCharts = sortedCharts.filter(chart => {
                                const isUnavailable = chart.chartType === 'Table' || 
                                                    chart.chartType === '?' || 
                                                    chart.chartType === 'Auto';
                                const hasPreview = previewImages.has(chart.id);
                                return !isUnavailable && hasPreview;
                            });

                            if (availableCharts.length === 0) {
                                return (
                                    <p className="text-muted-foreground">
                                        No available charts to display. Charts may still be loading or unavailable.
                                    </p>
                                );
                            }

                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {availableCharts.map((chart) => {
                                        const table = tables.find(t => t.id === chart.tableRef);
                                        const previewImage = previewImages.get(chart.id);
                                        const isSelected = selectedChartIds.has(chart.id);
                                        
                                        return (
                                        <Card
                                            key={chart.id}
                                            className={cn(
                                                "cursor-pointer relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                                                isSelected 
                                                    ? "bg-primary/5 border-2 border-primary" 
                                                    : "bg-background border"
                                            )}
                                            onClick={() => toggleChartSelection(chart.id)}
                                        >
                                            <div className="relative">
                                                <div 
                                                    className="absolute top-1 right-1 z-10 bg-white/90 rounded p-0.5 hover:bg-white"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleChartSelection(chart.id)}
                                                    />
                                                </div>
                                                <img
                                                    src={previewImage!.url}
                                                    alt={chart.chartType}
                                                    className="p-2 w-[calc(100%-16px)] h-auto block object-contain bg-white"
                                                    style={{ maxHeight: config.defaultChartHeight }}
                                                />
                                            </div>
                                            <CardContent className="p-2">
                                                <span className="block font-medium text-xs truncate">
                                                    {chart.chartType}
                                                </span>
                                                {table?.displayId && (
                                                    <span className="block text-xs text-muted-foreground truncate">
                                                        {table.displayId}
                                                    </span>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                            );
                        })()}
                    </div>
                </div>
            ) : mode === 'post' ? (
                <div className="h-full flex flex-col overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={isGenerating}
                            onClick={() => setMode('compose')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            create a new report
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            AI generated the post from the selected charts, and it could be inaccurate!
                        </span>
                    </div>
                    <div className="flex-1 flex overflow-hidden relative">
                        {/* Table of Contents Sidebar */}
                        {allGeneratedReports.length > 0 && (
                            <div className="absolute top-0 left-2 z-10 w-[200px] flex overflow-y-auto flex-col border-r h-fit bg-background/90">
                                <Collapsible open={!hideTableOfContents} onOpenChange={(open) => setHideTableOfContents(!open)}>
                                    <CollapsibleTrigger asChild>
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            className="w-full justify-start text-left rounded-none text-xs py-2 px-4"
                                        >
                                            {hideTableOfContents ? (
                                                <ChevronDown className="w-4 h-4 mr-2" />
                                            ) : (
                                                <ChevronUp className="w-4 h-4 mr-2" />
                                            )}
                                            {hideTableOfContents ? 'show all reports' : 'reports'}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        {allGeneratedReports.map((report) => (
                                            <div key={report.id} className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => loadReport(report.id)}
                                                    className={cn(
                                                        "text-xs w-full justify-start text-left rounded-none py-2 px-4",
                                                        currentReportId === report.id 
                                                            ? "text-primary border-r-2 border-primary" 
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block font-medium text-inherit mb-0.5">
                                                            {report.content.split('\n')[0]}
                                                        </span>
                                                        <span className="block text-[10px] text-muted-foreground truncate">
                                                            {new Date(report.createdAt).toLocaleDateString()} • {report.style}
                                                        </span>
                                                    </div>
                                                </Button>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            disabled={isGenerating}
                                                            onClick={(e) => deleteReport(report.id, e)}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-amber-600 hover:text-amber-700 hover:scale-110 transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete report</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}
                        
                        {/* Main Content Area */}
                        <div className="flex-1 overflow-y-auto relative">
                            {/* Action Buttons */}
                            {currentReportId && (
                                <div className="absolute top-4 right-4 z-10 flex gap-2">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    // Convert report to Chartifact markdown format
                                                    const chartifactMarkdown = convertToChartifact(
                                                        generatedReport,
                                                        generatedStyle,
                                                        charts,
                                                        tables,
                                                        conceptShelfItems,
                                                        config
                                                    );
                                                    openChartifactViewer(chartifactMarkdown);
                                                }}
                                            >
                                                <FileText className="w-4 h-4 mr-1.5" />
                                                Create Chartifact
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Create Chartifact report</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="sm"
                                                onClick={shareReportAsImage}
                                                className={cn(
                                                    "transition-all duration-300",
                                                    shareButtonSuccess && "bg-green-600 hover:bg-green-700"
                                                )}
                                            >
                                                {shareButtonSuccess ? (
                                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                                ) : (
                                                    <Share2 className="w-4 h-4 mr-1.5" />
                                                )}
                                                {shareButtonSuccess ? 'Copied!' : 'Share Image'}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Share report as image</TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                            
                            <div className="flex justify-center w-full py-6">
                                <div
                                    data-report-content
                                    className={cn(
                                        "w-full antialiased",
                                        (generatedStyle === 'social post' || generatedStyle === 'short note') && 
                                            "max-w-[520px] rounded-xl border p-5 bg-white text-sm font-normal leading-relaxed",
                                        generatedStyle === 'executive summary' && 
                                            "max-w-[700px] p-5 bg-white text-sm leading-relaxed",
                                        (generatedStyle !== 'social post' && generatedStyle !== 'short note' && generatedStyle !== 'executive summary') && 
                                            "max-w-[800px] px-12 py-0 bg-background text-sm leading-7"
                                    )}
                                    style={{
                                        fontFamily: generatedStyle === 'executive summary' ? FONT_FAMILY_SERIF : FONT_FAMILY_SYSTEM,
                                        color: generatedStyle === 'executive summary' ? COLOR_EXEC_TEXT : 
                                               (generatedStyle === 'social post' || generatedStyle === 'short note') ? COLOR_SOCIAL_TEXT : COLOR_BODY,
                                        borderColor: (generatedStyle === 'social post' || generatedStyle === 'short note') ? COLOR_SOCIAL_BORDER : undefined
                                    }}
                                >
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={getMarkdownComponents(generatedStyle)}
                                    >
                                        {displayedReport}
                                    </ReactMarkdown>
                                    
                                    {/* Attribution */}
                                    <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                                        created with AI using{' '}
                                        <a 
                                            href="https://github.com/microsoft/data-formulator" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            https://github.com/microsoft/data-formulator
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
        </TooltipProvider>
    );
};
