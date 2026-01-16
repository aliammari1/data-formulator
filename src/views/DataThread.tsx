// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";

import { VegaEmbed } from "react-vega";

import "../scss/VisualizationView.scss";
import { batch, useDispatch, useSelector } from "react-redux";
import { DataFormulatorState, dfActions, SSEMessage } from "../app/dfSlice";
import { assembleVegaChart, getTriggers, prepVisTable } from "../app/utils";
import {
  Chart,
  DictTable,
  EncodingItem,
  FieldItem,
  Trigger,
} from "../components/ComponentType";

import {
  Trash2,
  BarChart3,
  Star,
  ArrowDown,
  Table2,
  Anchor,
  Circle,
  TrendingUp,
  Check,
  X,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Paperclip,
  Loader2,
} from "lucide-react";

import _ from "lodash";
import { getChartTemplate } from "../components/ChartTemplates";

import "prismjs/components/prism-python"; // Language
import "prismjs/components/prism-typescript"; // Language
import "prismjs/themes/prism.css"; //Example style, you can use another

import {
  checkChartAvailability,
  generateChartSkeleton,
  getDataTable,
} from "./VisualizationView";
import { TriggerCard } from "./EncodingShelfCard";

import { dfSelectors } from "../app/dfSlice";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const ThinkingBanner = (message: string, className?: string) => (
  <div
    className={cn(
      "flex relative overflow-hidden",
      "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full",
      "before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent",
      "before:animate-[windowWipe_2s_ease-in-out_infinite] before:z-[1] before:pointer-events-none",
      className
    )}
    style={{
      // Define keyframes inline since Tailwind doesn't have windowWipe by default
    }}
  >
    <style>
      {`
        @keyframes windowWipe {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}
    </style>
    <div className="flex items-center justify-start">
      <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
      <span className="ml-1 text-[10px] text-black/70">
        {message}
      </span>
    </div>
  </div>
);

// Metadata Popup Component
const MetadataPopup = memo<{
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSave: (metadata: string) => void;
  initialValue: string;
  tableName: string;
}>(({ open, anchorEl, onClose, onSave, initialValue, tableName }) => {
  const [metadata, setMetadata] = useState(initialValue);

  let hasChanges = metadata !== initialValue;

  useEffect(() => {
    setMetadata(initialValue);
  }, [initialValue, open]);

  const handleSave = () => {
    onSave(metadata);
    onClose();
  };

  const handleCancel = () => {
    setMetadata(initialValue);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && e.ctrlKey) {
      handleSave();
    }
  };

  if (!open || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      className="fixed z-[1300]"
      style={{
        top: rect.bottom + 4,
        left: rect.left,
      }}
    >
      <div
        className="w-[480px] text-xs p-4 mt-1 border border-border rounded-md shadow-lg bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium mb-1">
          Attach metadata to{" "}
          <span className="text-primary">
            {tableName}
          </span>
        </p>
        <Textarea
          autoFocus
          placeholder="Attach additional contexts or guidance so that AI agents can better understand and process the data."
          className="my-2 text-xs min-h-[72px] max-h-[400px]"
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="mt-2 flex gap-2 items-center justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save
          </Button>
        </div>
      </div>
      {/* Click away overlay */}
      <div
        className="fixed inset-0 -z-10"
        onClick={handleCancel}
      />
    </div>
  );
});

// Agent Status Box Component
const AgentStatusBox = memo<{
  tableId: string;
  relevantAgentActions: any[];
  dispatch: any;
}>(({ tableId, relevantAgentActions, dispatch }) => {
  let agentStatus = undefined;

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-muted-foreground";
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-destructive";
      case "warning":
        return "text-yellow-600";
      default:
        return "text-muted-foreground";
    }
  };

  let currentActions = relevantAgentActions;

  if (currentActions.some((a) => a.status == "running")) {
    agentStatus = "running";
  } else if (currentActions.every((a) => a.status == "completed")) {
    agentStatus = "completed";
  } else if (currentActions.every((a) => a.status == "failed")) {
    agentStatus = "failed";
  } else {
    agentStatus = "warning";
  }

  if (currentActions.length === 0) {
    return null;
  }

  return (
    <div className="px-2">
      <div
        className={cn(
          "py-1 flex items-center justify-start",
          getAgentStatusColor(agentStatus)
        )}
      >
        {agentStatus === "running" &&
          ThinkingBanner("thinking...", "py-0.5")}
        {agentStatus === "completed" && <CheckCircle2 className="h-2.5 w-2.5" />}
        {agentStatus === "failed" && <XCircle className="h-2.5 w-2.5" />}
        {agentStatus === "warning" && <HelpCircle className="h-2.5 w-2.5" />}
        <span className="ml-0.5 text-[10px]">
          {agentStatus === "warning" && "hmm..."}
          {agentStatus === "failed" && "oops..."}
          {agentStatus === "completed" && "completed"}
          {agentStatus === "running" && ""}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="delete-button p-0.5 ml-auto transition-opacity duration-200 hover:bg-accent rounded"
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch(
                    dfActions.deleteAgentWorkInProgress(
                      relevantAgentActions[0].actionId
                    )
                  );
                }}
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete message</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {currentActions.map((a, index, array) => {
        let descriptions = String(a.description).split("\n");
        return (
          <React.Fragment key={a.actionId + "-" + index}>
            <div className="relative">
              {descriptions.map((line: string, lineIndex: number) => (
                <React.Fragment key={lineIndex}>
                  <p
                    className={cn(
                      "text-[10px] whitespace-pre-wrap break-words",
                      getAgentStatusColor(a.status)
                    )}
                  >
                    {line}
                  </p>
                  {lineIndex < descriptions.length - 1 && (
                    <Separator className="my-0.5" />
                  )}
                </React.Fragment>
              ))}
            </div>
            {index < array.length - 1 && array.length > 1 && (
              <div className="ml-1 h-px bg-black/20 my-0.5" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

let buildChartCard = (
  chartElement: { tableId: string; chartId: string; element: any },
  focusedChartId?: string,
  unread?: boolean
) => {
  let selectedClassName =
    focusedChartId == chartElement.chartId ? "selected-card" : "";
  return (
    <Card
      className={cn(
        "data-thread-card w-full flex relative",
        selectedClassName,
        unread && "shadow-[0_0_6px_rgba(255,152,0,0.15),0_0_12px_rgba(255,152,0,0.15)]"
      )}
    >
      {chartElement.element}
    </Card>
  );
};

const EditableTableName: FC<{
  initialValue: string;
  tableId: string;
  handleUpdateTableDisplayId: (tableId: string, displayId: string) => void;
  className?: string;
}> = ({ initialValue, tableId, handleUpdateTableDisplayId, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue);

  const handleSubmit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (inputValue.trim() !== "") {
      // Only update if input is not empty
      handleUpdateTableDisplayId(tableId, inputValue);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    } else if (e.key === "Escape") {
      setInputValue(initialValue);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={(event) => {
                event.stopPropagation();
                setIsEditing(true);
              }}
              className={cn(
                "min-w-[60px] max-w-[90px] break-words whitespace-normal ml-0.5 p-0.5",
                "hover:bg-black/5 hover:rounded-sm hover:cursor-pointer",
                className
              )}
            >
              {initialValue}
            </span>
          </TooltipTrigger>
          <TooltipContent>edit table name</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span
      onClick={(event) => event.stopPropagation()}
      className="flex items-center relative ml-0.5"
    >
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-6 w-16 px-2 py-0.5 text-inherit"
        onBlur={(e) => {
          // Only reset if click is not on the submit button
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setInputValue(initialValue);
            setIsEditing(false);
          }
        }}
      />
      <button
        className="absolute right-0.5 p-0.5 min-w-0 z-[1] hover:bg-accent rounded"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent blur from firing before click
        }}
        onClick={(e) => handleSubmit(e)}
      >
        <Check className="h-3 w-3" />
      </button>
    </span>
  );
};

let SingleThreadGroupView: FC<{
  scrollRef: any;
  threadIdx: number;
  leafTables: DictTable[];
  chartElements: { tableId: string; chartId: string; element: any }[];
  usedIntermediateTableIds: string[];
  className?: string;
}> = function ({
  scrollRef,
  threadIdx,
  leafTables,
  chartElements,
  usedIntermediateTableIds, // tables that have been used
  className,
}) {
  let tables = useSelector((state: DataFormulatorState) => state.tables);

  let leafTableIds = leafTables.map((lt) => lt.id);
  let parentTableId = leafTables[0].derive?.trigger.tableId || undefined;
  let parentTable = tables.find((t) => t.id == parentTableId) as DictTable;

  let charts = useSelector(dfSelectors.getAllCharts);
  let focusedChartId = useSelector(
    (state: DataFormulatorState) => state.focusedChartId
  );
  let focusedTableId = useSelector(
    (state: DataFormulatorState) => state.focusedTableId
  );
  let agentActions = useSelector(
    (state: DataFormulatorState) => state.agentActions
  );

  // Metadata popup state
  const [metadataPopupOpen, setMetadataPopupOpen] = useState(false);
  const [selectedTableForMetadata, setSelectedTableForMetadata] =
    useState<DictTable | null>(null);
  const [metadataAnchorEl, setMetadataAnchorEl] = useState<HTMLElement | null>(
    null
  );

  let handleUpdateTableDisplayId = (tableId: string, displayId: string) => {
    dispatch(
      dfActions.updateTableDisplayId({
        tableId: tableId,
        displayId: displayId,
      })
    );
  };

  const handleOpenMetadataPopup = (table: DictTable, anchorEl: HTMLElement) => {
    setSelectedTableForMetadata(table);
    setMetadataAnchorEl(anchorEl);
    setMetadataPopupOpen(true);
  };

  const handleCloseMetadataPopup = () => {
    setMetadataPopupOpen(false);
    setSelectedTableForMetadata(null);
    setMetadataAnchorEl(null);
  };

  const handleSaveMetadata = (metadata: string) => {
    if (selectedTableForMetadata) {
      dispatch(
        dfActions.updateTableAttachedMetadata({
          tableId: selectedTableForMetadata.id,
          attachedMetadata: metadata,
        })
      );
    }
  };

  let buildTriggerCard = (trigger: Trigger) => {
    let selectedClassName =
      trigger.chart?.id == focusedChartId ? "selected-card" : "";

    let triggerCard = (
      <div key={"thread-card-trigger-box"}>
        <div className="flex-1">
          <TriggerCard
            className={cn(
              selectedClassName,
              highlightedTableIds.includes(trigger.resultTableId) && "border-l-[3px] border-l-primary/50"
            )}
            trigger={trigger}
            hideFields={trigger.instruction != ""}
          />
        </div>
      </div>
    );

    return (
      <div
        className="flex flex-col"
        key={`trigger-card-${trigger.chart?.id}`}
      >
        {triggerCard}
        <div key={"down-arrow"} className="min-w-0">
          <ArrowDown
            className={cn(
              "h-3 w-3",
              highlightedTableIds.includes(trigger.resultTableId)
                ? "text-primary stroke-[1.5]"
                : "text-gray-400"
            )}
          />
        </div>
      </div>
    );
  };

  let buildTableCard = (tableId: string) => {
    if (
      parentTable &&
      tableId == parentTable.id &&
      parentTable.anchored &&
      tableIdList.length > 1
    ) {
      let table = tables.find((t) => t.id == tableId);
      return (
        <span className="bg-transparent">
          <div
            className="m-0 w-fit flex cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-black/5 hover:shadow-sm"
            onClick={(event) => {
              event.stopPropagation();
              dispatch(dfActions.setFocusedTable(tableId));

              // Find and set the first chart associated with this table
              let firstRelatedChart = charts.find(
                (c: Chart) => c.tableRef == tableId && c.source != "trigger"
              );

              if (firstRelatedChart) {
                dispatch(dfActions.setFocusedChart(firstRelatedChart.id));
              }
            }}
          >
            <div className="flex items-center gap-0.5 ml-0.5 mr-auto text-xs">
              <Anchor className="h-3.5 w-3.5 text-black/50" />
              <span className="text-center text-black/70 max-w-[100px] break-words whitespace-normal">
                {table?.displayId || tableId}
              </span>
            </div>
          </div>
        </span>
      );
    }

    // filter charts relavent to this
    let relevantCharts = chartElements.filter(
      (ce) =>
        ce.tableId == tableId && !usedIntermediateTableIds.includes(tableId)
    );

    let table = tables.find((t) => t.id == tableId);

    let selectedClassName = tableId == focusedTableId ? "selected-card" : "";

    let releventChartElements = relevantCharts.map((ce, j) => (
      <div
        key={`relevant-chart-${ce.chartId}`}
        className={cn(
          "flex p-0",
          j == relevantCharts.length - 1 ? "pb-1" : "pb-0.5",
          collapsed ? "w-1/2 [&_canvas]:w-[60px] [&_canvas]:max-h-[50px]" : "w-full"
        )}
      >
        {buildChartCard(
          ce,
          focusedChartId,
          charts.find((c) => c.id == ce.chartId)?.unread
        )}
      </div>
    ));

    // only charts without dependency can be deleted
    let tableDeleteEnabled = !tables.some(
      (t) => t.derive?.trigger.tableId == tableId
    );

    let tableCardIcon = table?.anchored ? (
      <Anchor
        className={cn(
          "h-4 w-4",
          tableId === focusedTableId ? "text-primary" : "text-black/50"
        )}
      />
    ) : (
      <Table2 className="h-4 w-4" />
    );

    let regularTableBox = (
      <div
        key={`regular-table-box-${tableId}`}
        ref={
          relevantCharts.some((c) => c.chartId == focusedChartId)
            ? scrollRef
            : null
        }
        className="p-0"
      >
        <Card
          className={cn(
            "data-thread-card w-full bg-primary/10 cursor-pointer",
            selectedClassName,
            highlightedTableIds.includes(tableId)
              ? "border-l-[3px] border-l-primary"
              : "border-l border-l-gray-300"
          )}
          onClick={() => {
            dispatch(dfActions.setFocusedTable(tableId));
            if (focusedChart?.tableRef != tableId) {
              let firstRelatedChart = charts.find(
                (c: Chart) => c.tableRef == tableId && c.source != "trigger"
              );
              if (firstRelatedChart) {
                dispatch(dfActions.setFocusedChart(firstRelatedChart.id));
              } else {
                //dispatch(dfActions.createNewChart({ tableId: tableId, chartType: '?' }));
              }
            }
          }}
        >
          <div className="m-0 flex">
            <div className="flex items-center gap-0.5 ml-0.5 mr-auto text-xs">
              <button
                className={cn(
                  "min-w-0 p-0.5 hover:scale-[1.3] transition-all duration-100 rounded",
                  "disabled:text-black/50 text-primary"
                )}
                disabled={
                  table?.derive == undefined ||
                  tables.some((t) => t.derive?.trigger.tableId == tableId)
                }
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch(
                    dfActions.updateTableAnchored({
                      tableId: tableId,
                      anchored: !table?.anchored,
                    })
                  );
                }}
              >
                {tableCardIcon}
              </button>
              <div className="my-1 mx-2 flex items-center">
                {table?.virtual ? <Cloud className="h-2.5 w-2.5" /> : ""}
                {focusedTableId == tableId ? (
                  <EditableTableName
                    initialValue={table?.displayId || tableId}
                    tableId={tableId}
                    handleUpdateTableDisplayId={handleUpdateTableDisplayId}
                  />
                ) : (
                  <span
                    className={cn(
                      "text-center text-black/70 max-w-[90px] break-words whitespace-normal",
                      table?.virtual && "ml-0.5"
                    )}
                  >
                    {table?.displayId || tableId}
                  </span>
                )}
              </div>
            </div>
            <div className="flex text-right my-auto ml-auto mr-0.5">
              <TooltipProvider>
                {table?.derive == undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        aria-label="attach metadata"
                        className="p-0.5 hover:scale-[1.2] transition-all duration-100 rounded"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenMetadataPopup(table!, event.currentTarget);
                        }}
                      >
                        <Paperclip
                          className={cn(
                            "h-[18px] w-[18px]",
                            table?.attachedMetadata
                              ? "text-secondary-foreground"
                              : "text-muted-foreground opacity-70"
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {table?.attachedMetadata
                        ? "edit table metadata"
                        : "attach table metadata"}
                    </TooltipContent>
                  </Tooltip>
                )}

                {tableDeleteEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        aria-label="delete table"
                        className="p-0.5 hover:scale-[1.2] transition-all duration-100 rounded"
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatch(dfActions.deleteTable(tableId));
                        }}
                      >
                        <Trash2 className="h-[18px] w-[18px] text-orange-500" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>delete table</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="create a new chart"
                      className="p-0.5 hover:scale-[1.2] transition-all duration-100 rounded"
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch(dfActions.setFocusedTable(tableId));
                        dispatch(dfActions.setFocusedChart(undefined));
                      }}
                    >
                      <BarChart3 className="h-[18px] w-[18px] text-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>create a new chart</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </Card>
      </div>
    );

    let relevantAgentActions = agentActions
      .filter((a) => a.tableId == tableId)
      .filter((a) => a.hidden == false);

    let agentActionBox = (
      <AgentStatusBox
        tableId={tableId}
        relevantAgentActions={relevantAgentActions}
        dispatch={dispatch}
      />
    );

    return [
      regularTableBox,
      <div
        key={`table-associated-elements-box-${tableId}`}
        className="flex flex-row"
      >
        {!leafTableIds.includes(tableId) && (
          <div
            className={cn(
              "min-w-[1px] p-0 w-4 flex-none flex",
              highlightedTableIds.includes(tableId)
                ? "ml-[7px] border-l-[3px] border-l-primary"
                : "ml-2 border-l border-l-gray-400 border-dashed"
            )}
          >
            <div
              className="p-0 w-px m-auto"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, darkgray, darkgray 75%, transparent 75%, transparent 100%)",
                backgroundSize: "1px 6px, 3px 100%",
              }}
            ></div>
          </div>
        )}
        <div
          className={cn(
            "flex-1 py-2 min-h-2",
            collapsed && "flex flex-wrap"
          )}
        >
          {releventChartElements}
          {agentActionBox}
        </div>
      </div>,
    ];
  };

  let focusedChart = useSelector((state: DataFormulatorState) =>
    charts.find((c) => c.id == focusedChartId)
  );

  const dispatch = useDispatch();

  let [collapsed, setCollapsed] = useState<boolean>(false);

  const w: any = (a: any[], b: any[], spaceElement?: any) =>
    a.length
      ? [
          a[0],
          b.length == 0 ? "" : spaceElement || "",
          ...w(b, a.slice(1), spaceElement),
        ]
      : b;

  let triggers = parentTable ? getTriggers(parentTable, tables) : [];
  let tableIdList = parentTable
    ? [...triggers.map((trigger) => trigger.tableId), parentTable.id]
    : [];

  let usedTableIdsInThread = tableIdList.filter((id) =>
    usedIntermediateTableIds.includes(id)
  );
  let newTableIds = tableIdList.filter(
    (id) => !usedTableIdsInThread.includes(id)
  );
  let newTriggers = triggers.filter((tg) =>
    newTableIds.includes(tg.resultTableId)
  );

  let highlightedTableIds: string[] = [];
  if (focusedTableId && leafTableIds.includes(focusedTableId)) {
    highlightedTableIds = [...tableIdList, focusedTableId];
  } else if (focusedTableId && newTableIds.includes(focusedTableId)) {
    highlightedTableIds = tableIdList.slice(
      0,
      tableIdList.indexOf(focusedTableId) + 1
    );
  }

  let tableElementList = newTableIds.map((tableId, i) =>
    buildTableCard(tableId)
  );
  let triggerCards = newTriggers.map((trigger) => buildTriggerCard(trigger));

  let leafTableComp =
    leafTables.length > 1
      ? leafTables.map((lt, i) => {
          let leafTrigger = lt.derive?.trigger;

          let isHighlighted = focusedTableId && leafTableIds.indexOf(focusedTableId) > i;
          let isFocused = focusedTableId && lt.id == focusedTableId;
          let isLast = i == leafTables.length - 1;

          let spaceBox = (
            <div
              className={cn(
                "h-4 w-4 flex-shrink-0",
                isLast ? "border-l border-l-black/30 border-dashed" : "",
                "border-b border-b-black/30 border-dashed"
              )}
            ></div>
          );

          if (isFocused) {
            spaceBox = (
              <div
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isLast ? "-ml-px" : "-ml-0.5",
                  "border-l-[3px] border-l-primary",
                  "border-b-[3px] border-b-primary"
                )}
              ></div>
            );
          }

          return (
            <div
              key={`leaf-table-stack-${lt.id}`}
              className={cn(
                "w-[208px] flex flex-row",
                isHighlighted ? "ml-[7px] border-l-[3px] border-l-primary" : "ml-2",
                !isLast && !isHighlighted && "border-l border-l-black/30 border-dashed"
              )}
            >
              {spaceBox}
              <div className="flex flex-col flex-1">
                {leafTrigger && buildTriggerCard(leafTrigger)}
                {buildTableCard(lt.id)}
              </div>
            </div>
          );
        })
      : leafTables.map((lt, i) => {
          return (
            <div
              key={`leaf-table-stack-${lt.id}`}
              className="ml-0 w-48 flex flex-row"
            >
              <div className="flex flex-col flex-1">
                {lt.derive?.trigger && buildTriggerCard(lt.derive.trigger)}
                {buildTableCard(lt.id)}
              </div>
            </div>
          );
        });

  return (
    <div
      className={cn(
        className,
        "[&_.selected-card]:border-2 [&_.selected-card]:border-primary transition-shadow duration-100"
      )}
      data-thread-index={threadIdx}
    >
      <div className="flex ltr m-0.5 mb-2">
        <div className="flex items-center m-auto">
          <div className="w-[60px] h-0.5 bg-primary/20"></div>
          <span className="text-[10px] text-muted-foreground px-2">
            {`thread - ${threadIdx + 1}`}
          </span>
          <div className="w-[60px] h-0.5 bg-primary/20"></div>
        </div>
      </div>
      <div className="px-1 py-0.5 mt-0 ltr">
        {usedTableIdsInThread.map((tableId, i) => {
          let table = tables.find((t) => t.id === tableId) as DictTable;
          return [
            <span
              key={`thread-used-table-${tableId}-${i}-text`}
              className="text-[10px] cursor-pointer w-fit hover:bg-primary/10"
              onClick={() => {
                dispatch(dfActions.setFocusedTable(tableId));
              }}
            >
              {table.displayId || tableId}
            </span>,
            <div
              key={`thread-used-table-${tableId}-${i}-gap-box`}
              className={cn(
                "min-w-[1px] p-0 w-4 flex-none flex h-2.5",
                highlightedTableIds.includes(tableId)
                  ? "ml-[7px] border-l-[3px] border-l-primary"
                  : "ml-2 border-l border-dashed border-l-gray-400"
              )}
            ></div>,
          ];
        })}
        <div className="flex w-48 flex-col flex-1">
          {tableElementList.length > triggerCards.length
            ? w(tableElementList, triggerCards, "")
            : w(triggerCards, tableElementList, "")}
        </div>
        {leafTableComp}
      </div>
      <MetadataPopup
        open={metadataPopupOpen}
        anchorEl={metadataAnchorEl}
        onClose={handleCloseMetadataPopup}
        onSave={handleSaveMetadata}
        initialValue={selectedTableForMetadata?.attachedMetadata || ""}
        tableName={
          selectedTableForMetadata?.displayId ||
          selectedTableForMetadata?.id ||
          ""
        }
      />
    </div>
  );
};

const VegaLiteChartElement: FC<{
  chart: Chart;
  assembledSpec: any;
  table: any;
  status: "available" | "pending" | "unavailable";
  isSaved?: boolean;
  onChartClick: (chartId: string, tableId: string) => void;
  onDelete: (chartId: string) => void;
}> = memo(
  ({
    chart,
    assembledSpec,
    table,
    status,
    isSaved,
    onChartClick,
    onDelete,
  }) => {
    const id = `data-thread-chart-Element-${chart.id}`;
    return (
      <div
        onClick={() => onChartClick(chart.id, table.id)}
        className="vega-thumbnail-box w-full relative cursor-pointer"
      >
        <div className="m-auto">
          {isSaved && (
            <span className="absolute m-[5px] z-[2]">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </span>
          )}
          {status == "pending" && (
            <div className="absolute h-full w-full z-20 bg-gray-100/80 flex items-center cursor-pointer">
              <Progress className="w-full h-full opacity-5" />
            </div>
          )}
          <div className="data-thread-chart-card-action-button z-10 text-blue-500 absolute right-0.5 bg-white/95">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1 text-orange-500 hover:bg-accent rounded"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(chart.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>delete chart</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div
            className={cn(
              "vega-thumbnail flex",
              isSaved ? "bg-yellow-50" : "bg-white",
              "[&_.vega-embed]:m-auto",
              "[&_canvas]:w-auto [&_canvas]:h-auto [&_canvas]:max-w-[120px] [&_canvas]:max-h-[100px]"
            )}
            id={id}
          >
            <VegaEmbed spec={assembledSpec} />
          </div>
        </div>
      </div>
    );
  }
);

const MemoizedChartObject = memo<{
  chart: Chart;
  table: DictTable;
  conceptShelfItems: FieldItem[];
  status: "available" | "pending" | "unavailable";
  onChartClick: (chartId: string, tableId: string) => void;
  onDelete: (chartId: string) => void;
}>(
  ({ chart, table, conceptShelfItems, status, onChartClick, onDelete }) => {
    let visTableRows: any[] = [];
    if (table.rows.length > 1000) {
      visTableRows = structuredClone(_.sampleSize(table.rows, 1000));
    } else {
      visTableRows = structuredClone(table.rows);
    }

    // Preprocess the data for aggregations (same as VisualizationView)
    visTableRows = prepVisTable(
      visTableRows,
      conceptShelfItems,
      chart.encodingMap
    );

    let deleteButton = (
      <div className="data-thread-chart-card-action-button z-10 text-blue-500 absolute right-0.5 bg-white/95">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 text-orange-500 hover:bg-accent rounded"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(chart.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>delete chart</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );

    if (["Auto", "?"].includes(chart.chartType)) {
      let element = (
        <div
          className="vega-thumbnail-box w-full text-muted-foreground h-12 flex bg-white relative flex-col cursor-pointer"
          onClick={() => onChartClick(chart.id, table.id)}
        >
          {status == "pending" ? (
            <div className="absolute h-full w-full z-20 bg-gray-100/80 flex items-center cursor-pointer">
              <Progress className="w-full h-full opacity-5" />
            </div>
          ) : (
            ""
          )}
          <TrendingUp className="m-auto h-6 w-6 text-gray-400" />
          {deleteButton}
        </div>
      );
      return element;
    }

    if (status == "unavailable" || chart.chartType == "Table") {
      let chartTemplate = getChartTemplate(chart.chartType);

      let element = (
        <div
          key={`unavailable-${chart.id}`}
          className="vega-thumbnail vega-thumbnail-box w-full flex bg-white relative flex-col cursor-pointer"
          onClick={() => onChartClick(chart.id, table.id)}
        >
          {status == "pending" ? (
            <div className="absolute h-full w-full z-20 bg-gray-100/80 flex items-center cursor-pointer">
              <Progress className="w-full h-full opacity-5" />
            </div>
          ) : (
            ""
          )}
          <div className="flex flex-col m-auto h-12">
            <div
              className="m-auto"
              style={{
                transform:
                  chart.chartType == "Table" ? "rotate(15deg)" : undefined,
              }}
            >
              {generateChartSkeleton(
                chartTemplate?.icon,
                32,
                32,
                chart.chartType == "Table" ? 1 : 0.5
              )}
            </div>
            {deleteButton}
          </div>
        </div>
      );
      return element;
    }

    // prepare the chart to be rendered
    let assembledChart = assembleVegaChart(
      chart.chartType,
      chart.encodingMap,
      conceptShelfItems,
      visTableRows,
      table.metadata,
      20,
      true
    );
    assembledChart["background"] = "transparent";

    // Temporary fix, down sample the dataset
    if (assembledChart["data"]["values"].length > 5000) {
      let values = assembledChart["data"]["values"];
      assembledChart = (({ data, ...o }) => o)(assembledChart);

      let getRandom = (seed: number) => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      let getRandomSubarray = (arr: any[], size: number) => {
        let shuffled = arr.slice(0),
          i = arr.length,
          temp,
          index;
        while (i--) {
          index = Math.floor((i + 1) * getRandom(233 * i + 888));
          temp = shuffled[index];
          shuffled[index] = shuffled[i];
          shuffled[i] = temp;
        }
        return shuffled.slice(0, size);
      };
      assembledChart["data"] = { values: getRandomSubarray(values, 5000) };
    }

    assembledChart["config"] = {
      axis: { labelLimit: 30 },
    };

    const element = (
      <VegaLiteChartElement
        chart={chart}
        assembledSpec={assembledChart}
        table={table}
        status={status}
        isSaved={chart.saved}
        onChartClick={() => onChartClick(chart.id, table.id)}
        onDelete={() => onDelete(chart.id)}
      />
    );

    return element;
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memoization
    // Only re-render if the chart or its dependencies have changed

    // when conceptShelfItems change, we only need to re-render the chart if the conceptShelfItems depended by the chart have changed
    let nextReferredConcepts = Object.values(nextProps.chart.encodingMap)
      .filter((e) => e.fieldID || e.aggregate)
      .map((e) => `${e.fieldID}:${e.aggregate}`);

    return (
      prevProps.chart.id === nextProps.chart.id &&
      prevProps.chart.chartType === nextProps.chart.chartType &&
      prevProps.chart.saved === nextProps.chart.saved &&
      prevProps.status === nextProps.status &&
      _.isEqual(prevProps.chart.encodingMap, nextProps.chart.encodingMap) &&
      // Only check tables/charts that this specific chart depends on
      _.isEqual(prevProps.table, nextProps.table) &&
      _.isEqual(
        prevProps.table.attachedMetadata,
        nextProps.table.attachedMetadata
      ) &&
      // Check if conceptShelfItems have changed
      _.isEqual(
        prevProps.conceptShelfItems.filter((c) =>
          nextReferredConcepts.includes(c.id)
        ),
        nextProps.conceptShelfItems.filter((c) =>
          nextReferredConcepts.includes(c.id)
        )
      )
    );
  }
);

export const DataThread: FC<{ className?: string }> = function ({ className }) {
  let tables = useSelector((state: DataFormulatorState) => state.tables);
  let focusedTableId = useSelector(
    (state: DataFormulatorState) => state.focusedTableId
  );
  let charts = useSelector(dfSelectors.getAllCharts);

  let chartSynthesisInProgress = useSelector(
    (state: DataFormulatorState) => state.chartSynthesisInProgress
  );

  const conceptShelfItems = useSelector(
    (state: DataFormulatorState) => state.conceptShelfItems
  );

  let [threadDrawerOpen, setThreadDrawerOpen] = useState<boolean>(false);

  const scrollRef = useRef<null | HTMLDivElement>(null);

  const executeScroll = (smooth: boolean = true) => {
    if (scrollRef.current != null) {
      scrollRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "center",
      });
    }
  };
  // run this function from an event handler or an effect to execute scroll

  const dispatch = useDispatch();

  useEffect(() => {
    // make it smooth when drawer from open -> close, otherwise just jump
    executeScroll(!threadDrawerOpen);
  }, [threadDrawerOpen]);

  useEffect(() => {
    // load the example datasets
    if (focusedTableId) {
      executeScroll(true);
    }
  }, [focusedTableId]);

  // Now use useMemo to memoize the chartElements array
  let chartElements = useMemo(() => {
    return charts
      .filter((c) => c.source == "user")
      .map((chart) => {
        const table = getDataTable(chart, tables, charts, conceptShelfItems);
        let status: "available" | "pending" | "unavailable" =
          chartSynthesisInProgress.includes(chart.id)
            ? "pending"
            : checkChartAvailability(chart, conceptShelfItems, table.rows)
            ? "available"
            : "unavailable";
        let element = (
          <MemoizedChartObject
            chart={chart}
            table={table}
            conceptShelfItems={conceptShelfItems}
            status={status}
            onChartClick={() => {
              dispatch(dfActions.setFocusedChart(chart.id));
              dispatch(dfActions.setFocusedTable(table.id));
            }}
            onDelete={() => {
              dispatch(dfActions.deleteChartById(chart.id));
            }}
          />
        );
        return { chartId: chart.id, tableId: table.id, element };
      });
  }, [charts, tables, conceptShelfItems, chartSynthesisInProgress]);

  // anchors are considered leaf tables to simplify the view

  let isLeafTable = (table: DictTable) => {
    let children = tables.filter((t) => t.derive?.trigger.tableId == table.id);
    if (children.length == 0 || children.every((t) => t.anchored)) {
      return true;
    }
    return false;
  };
  let leafTables = [...tables.filter((t) => isLeafTable(t))];

  // we want to sort the leaf tables by the order of their ancestors
  // for example if ancestor of list a is [0, 3] and the ancestor of list b is [0, 2] then b should come before a
  // when tables are anchored, we want to give them a higher order (so that they are displayed after their peers)
  let tableOrder = Object.fromEntries(
    tables.map((table, index) => [
      table.id,
      index + (table.anchored ? 1 : 0) * tables.length,
    ])
  );
  let getAncestorOrders = (leafTable: DictTable) => {
    let triggers = getTriggers(leafTable, tables);
    return [
      ...triggers.map((t) => tableOrder[t.tableId]),
      tableOrder[leafTable.id],
    ];
  };

  leafTables.sort((a, b) => {
    let aOrders = getAncestorOrders(a);
    let bOrders = getAncestorOrders(b);

    // If lengths are equal, compare orders in order
    for (let i = 0; i < Math.min(aOrders.length, bOrders.length); i++) {
      if (aOrders[i] !== bOrders[i]) {
        return aOrders[i] - bOrders[i];
      }
    }

    // If all orders are equal, compare the leaf tables themselves
    return aOrders.length - bOrders.length;
  });

  let leafTableGroups = leafTables.reduce(
    (groups: { [groupId: string]: DictTable[] }, leafTable) => {
      // Get the immediate parent table ID (first trigger in the chain)
      const triggers = getTriggers(leafTable, tables);
      const immediateParentTableId =
        triggers.length > 0 ? triggers[triggers.length - 1].tableId : "root";

      let groupId =
        immediateParentTableId + (leafTable.anchored ? "-" + leafTable.id : "");

      let subgroupIdCount = 0;
      while (groups[groupId] && groups[groupId].length >= 4) {
        groupId = groupId + "-" + subgroupIdCount;
        subgroupIdCount++;
      }

      // Initialize group if it doesn't exist
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      // Add leaf table to its group
      groups[groupId].push(leafTable);

      return groups;
    },
    {}
  );

  let drawerOpen = threadDrawerOpen && leafTables.length > 1;
  let collaposedViewWidth =
    Math.max(...Object.values(leafTableGroups).map((x) => x.length)) > 1
      ? 248
      : 232;

  let view = (
    <div
      className={cn(
        "overflow-auto relative flex flex-col ltr h-[calc(100%-16px)] gap-1 p-1 transition-[max-width] duration-100",
        drawerOpen ? "flex-wrap" : "flex-nowrap"
      )}
      style={{ maxWidth: drawerOpen ? 720 : collaposedViewWidth }}
    >
      {Object.entries(leafTableGroups).map(([groupId, leafTables], i) => {
        let usedIntermediateTableIds = Object.values(leafTableGroups)
          .slice(0, i)
          .flat()
          .map((x) => [...(getTriggers(x, tables).map((y) => y.tableId) || [])])
          .flat();
        let usedLeafTableIds = Object.values(leafTableGroups)
          .slice(0, i)
          .flat()
          .map((x) => x.id);

        return (
          <SingleThreadGroupView
            key={`thread-${groupId}-${i}`}
            scrollRef={scrollRef}
            threadIdx={i}
            leafTables={leafTables}
            chartElements={chartElements}
            usedIntermediateTableIds={[
              ...usedIntermediateTableIds,
              ...usedLeafTableIds,
            ]}
            className={cn(
              "bg-white rounded-lg p-1 my-0.5 flex-none flex flex-col h-fit transition-all duration-300",
              leafTables.length > 1 ? "w-[216px]" : "w-[200px]"
            )}
          />
        );
      })}
    </div>
  );

  let jumpButtonsDrawerOpen = (
    <div className="flex gap-0">
      <TooltipProvider>
        {_.chunk(
          Array.from(
            { length: Object.keys(leafTableGroups).length },
            (_, i) => i
          ),
          3
        ).map((group, groupIdx) => {
          const startNum = group[0] + 1;
          const endNum = group[group.length - 1] + 1;
          const label =
            startNum === endNum ? `${startNum}` : `${startNum}-${endNum}`;

          return (
            <Tooltip key={`thread-nav-group-${groupIdx}`}>
              <TooltipTrigger asChild>
                <button
                  className="p-1 text-xs text-primary hover:bg-accent rounded"
                  onClick={() => {
                    setTimeout(() => {
                      // Get currently most visible thread index
                      const viewportCenter = window.innerWidth / 2;
                      const currentIndex =
                        Array.from(
                          document.querySelectorAll("[data-thread-index]")
                        ).reduce((closest, element) => {
                          const rect = element.getBoundingClientRect();
                          const distance = Math.abs(
                            rect.left + rect.width / 2 - viewportCenter
                          );
                          if (!closest || distance < closest.distance) {
                            return {
                              index: parseInt(
                                element.getAttribute("data-thread-index") || "0"
                              ),
                              distance,
                            };
                          }
                          return closest;
                        }, null as { index: number; distance: number } | null)
                          ?.index || 0;

                      // If moving from larger to smaller numbers (scrolling left), target first element
                      // If moving from smaller to larger numbers (scrolling right), target last element
                      const targetIndex =
                        currentIndex > group[0]
                          ? group[0]
                          : group[group.length - 1];

                      const targetElement = document.querySelector(
                        `[data-thread-index="${targetIndex}"]`
                      );
                      if (targetElement) {
                        targetElement.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest", // Don't change vertical scroll
                          inline:
                            currentIndex > group[group.length - 1]
                              ? "start"
                              : "end",
                        });
                      }
                    }, 100);
                  }}
                >
                  {label}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {`Jump to thread${startNum === endNum ? "" : "s"} ${label}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );

  let jumpButtonDrawerClosed = (
    <div className="flex gap-0">
      <TooltipProvider>
        {Object.keys(leafTableGroups).map((groupId, idx) => (
          <Tooltip key={`thread-nav-${idx}`}>
            <TooltipTrigger asChild>
              <button
                className="p-1 text-xs text-primary hover:bg-accent rounded"
                onClick={() => {
                  const threadElement = document.querySelector(
                    `[data-thread-index="${idx}"]`
                  );
                  threadElement?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {idx + 1}
              </button>
            </TooltipTrigger>
            <TooltipContent>{`Jump to thread ${idx + 1}`}</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );

  let jumpButtons = drawerOpen ? jumpButtonsDrawerOpen : jumpButtonDrawerClosed;

  let carousel = (
    <div className={cn("data-thread relative", className)}>
      <div className="ltr flex pl-3 items-center justify-between">
        <div className="flex items-center gap-1">
          <h2 className="view-title mt-1.5">
            Data Threads
          </h2>
          {jumpButtons}
        </div>

        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    className={cn(
                      "p-1 text-primary hover:bg-accent rounded",
                      drawerOpen === false && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={drawerOpen === false}
                    onClick={() => {
                      setThreadDrawerOpen(false);
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>collapse</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    className={cn(
                      "p-1 text-primary hover:bg-accent rounded",
                      leafTables.length <= 1 && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={leafTables.length <= 1}
                    onClick={() => {
                      setThreadDrawerOpen(true);
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>expand</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="overflow-hidden rtl block flex-1 h-[calc(100%-48px)] transition-[width] duration-300">
        {view}
      </div>
    </div>
  );

  return carousel;
};
