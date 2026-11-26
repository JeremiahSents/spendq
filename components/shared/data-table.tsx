"use client"

/**
 * The one table every SpendIQ list uses: TanStack Table v9 for sorting and
 * pagination, shadcn table primitives for the markup.
 *
 * Ported from the Coinz admin `records-table`. TanStack v9 is not v8: there is
 * no `useReactTable` or `getCoreRowModel`; features are registered once in
 * `spendTableFeatures` and columns are typed against that set.
 *
 * Search and dropdown filters stay with the page: filter `rows` before passing
 * them in. The table owns sorting and paging only.
 */
import { useEffect, type ReactNode } from "react"
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SpendColumnMeta {
  align?: "left" | "center" | "right"
  /** Header and cells: widths, alignment. */
  className?: string
  /** Cells only (e.g. `max-w-0` to make a text column truncate). */
  cellClassName?: string
}

export const spendTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: {} as SpendColumnMeta,
})

/**
 * A column of a `DataTable`. Write columns with `accessorFn` + `id` (or
 * `accessorKey`) so they sort; use `cell: ({ row }) => …` for rendering and
 * `enableSorting: false` for action columns.
 */
export type SpendColumn<TData extends RowData> = ColumnDef<typeof spendTableFeatures, TData>

export function DataTable<TData extends RowData>({
  columns,
  rows,
  getRowId,
  onRowClick,
  empty,
  footer,
  initialSorting = [],
  pageSize = 25,
  caption,
  className,
}: {
  columns: Array<SpendColumn<TData>>
  rows: TData[]
  getRowId: (row: TData) => string
  onRowClick?: (row: TData) => void
  /** Rendered in place of the body when `rows` is empty (use EmptyState). */
  empty?: ReactNode
  /** Optional totals row content, one node per column (null for blank). */
  footer?: Array<ReactNode>
  initialSorting?: SortingState
  pageSize?: number
  caption?: string
  className?: string
}) {
  const table = useTable(
    {
      features: spendTableFeatures,
      columns,
      data: rows,
      getRowId,
      initialState: { sorting: initialSorting, pagination: { pageIndex: 0, pageSize } },
    },
    (state) => ({ pagination: state.pagination, sorting: state.sorting }),
  )

  const { pageIndex } = table.state.pagination
  const pageCount = table.getPageCount()

  // Filtering upstream can shrink the rows under the page cursor; clamp it.
  useEffect(() => {
    if (pageCount > 0 && pageIndex > pageCount - 1) table.setPageIndex(pageCount - 1)
  }, [pageCount, pageIndex, table])

  const pageRows = table.getRowModel().rows

  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "h-8 px-3 text-[11px] font-medium text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                          ) : sorted === "desc" ? (
                            <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                          ) : null}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-4">
                  {empty ?? <p className="py-6 text-center text-sm text-muted-foreground">No rows match.</p>}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return
                          event.preventDefault()
                          onRowClick(row.original)
                        }
                      : undefined
                  }
                  className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none")}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "h-10 px-3 py-1.5",
                          meta?.align === "right" && "text-right",
                          meta?.align === "center" && "text-center",
                          meta?.className,
                          meta?.cellClassName,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          {footer && pageRows.length > 0 ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                {footer.map((node, i) => (
                  <TableCell
                    key={i}
                    className={cn("h-9 px-3 font-medium", columns[i]?.meta?.align === "right" && "text-right", columns[i]?.meta?.className)}
                  >
                    {node}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 pt-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button variant="outline" size="xs" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="xs" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
