import { isNullOrUndefined, remove, extend } from '@syncfusion/ej2-base';
import { Query } from '@syncfusion/ej2-data';
import { IGrid, IAction, NotifyArgs, InfiniteScrollArgs, CellFocusArgs, KeyboardEventArgs, IModelGenerator } from '../base/interface';
import { RowModelGenerator } from '../services/row-model-generator';
import { FreezeRowModelGenerator } from '../services/freeze-row-model-generator';
import { RowRenderer } from '../renderer/row-renderer';
import { ServiceLocator } from '../services/service-locator';
import { Column } from '../models/column';
import { Row } from '../models/row';
import * as events from '../base/constant';
import { Grid } from '../base/grid';
import { getScrollBarWidth, ensureLastRow, ensureFirstRow, getEditedDataIndex, resetRowIndex, setRowElements } from '../base/util';
import { Action, freezeTable } from '../base/enum';
import { ColumnWidthService } from '../services/width-controller';
import * as literals from '../base/string-literals';

/**
 * Infinite Scrolling class
 *
 * @hidden
 */
export class InfiniteScroll implements IAction {
    private parent: IGrid;
    private serviceLocator: ServiceLocator;
    private maxPage: number;
    private actionBeginFunction: () => void;
    private actionCompleteFunction: () => void;
    private infiniteCache: { [x: number]: Row<Column>[] } = {};
    private infiniteCurrentViewData: { [x: number]: Object[] } = {};
    private infiniteFrozenCache: { [x: number]: Row<Column>[][] } = {};
    private isDownScroll: boolean = false;
    private isUpScroll: boolean = false;
    private isScroll: boolean = true;
    private top: number;
    private enableContinuousScroll: boolean = false;
    private initialRender: boolean = true;
    private pressedKey: string;
    private isRemove: boolean = false;
    private isInitialCollapse: boolean = false;
    protected prevScrollTop: number = 0;
    private actions: string[] = ['filtering', 'searching', 'grouping', 'ungrouping', 'reorder', 'sorting'];
    private keys: string[] = ['downArrow', 'upArrow', 'PageUp', 'PageDown'];
    private rowIndex: number;
    protected cellIndex: number;
    private rowTop: number = 0;
    private empty: number | string;
    private isInitialMovableRender: boolean = true;
    private frozenFrag: DocumentFragment;
    private movableFrag: DocumentFragment;
    private editRowIndex: number;
    private virtualInfiniteData: Object = {};
    private isAdd: boolean;
    private isEdit: boolean;
    private isCancel: boolean = false;
    private emptyRowData: Object = {};
    private isNormaledit: boolean = false;
    /** @hidden */
    public requestType: Action;
    private firstBlock: number;
    private firstIndex: number;
    private lastIndex: number;
    private rowModelGenerator: IModelGenerator<Column>;
    private isInfiniteScroll: boolean = false;
    private isLastPage: boolean = false;
    private isInitialRender: boolean = true;
    protected widthService: ColumnWidthService;

    /**
     * Constructor for the Grid infinite scrolling.
     *
     * @param {IGrid} parent - specifies the IGrid
     * @param {ServiceLocator} serviceLocator - specifies the ServiceLocator
     * @hidden
     */
    constructor(parent?: IGrid, serviceLocator?: ServiceLocator) {
        this.parent = parent;
        this.serviceLocator = serviceLocator;
        this.isNormaledit = this.parent.editSettings.mode === 'Normal';
        this.addEventListener();
        this.widthService = serviceLocator.getService<ColumnWidthService>('widthService');
        this.rowModelGenerator = this.parent.isFrozenGrid() ? new FreezeRowModelGenerator(this.parent)
            : new RowModelGenerator(this.parent);
    }

    public getModuleName(): string {
        return 'infiniteScroll';
    }

    /**
     * @returns {void}
     * @hidden
     */
    public addEventListener(): void {
        this.parent.on(events.dataReady, this.onDataReady, this);
        this.parent.on(events.dataSourceModified, this.dataSourceModified, this);
        this.parent.on(events.infinitePageQuery, this.infinitePageQuery, this);
        this.parent.on(events.infiniteScrollHandler, this.infiniteScrollHandler, this);
        this.parent.on(events.beforeCellFocused, this.infiniteCellFocus, this);
        this.parent.on(events.appendInfiniteContent, this.appendInfiniteRows, this);
        this.parent.on(events.removeInfiniteRows, this.removeInfiniteCacheRows, this);
        this.parent.on(events.resetInfiniteBlocks, this.resetInfiniteBlocks, this);
        this.parent.on(events.setInfiniteCache, this.setCache, this);
        this.parent.on(events.initialCollapse, this.ensureIntialCollapse, this);
        this.parent.on(events.keyPressed, this.infiniteCellFocus, this);
        this.parent.on(events.infiniteShowHide, this.setDisplayNone, this);
        this.parent.on(events.virtualScrollEditActionBegin, this.editActionBegin, this);
        this.parent.on(events.getVirtualData, this.getVirtualInfiniteData, this);
        this.parent.on(events.editReset, this.resetInfiniteEdit, this);
        this.parent.on(events.virtualScrollEditSuccess, this.infiniteEditSuccess, this);
        this.parent.on(events.refreshVirtualCache, this.refreshInfiniteCache, this);
        this.parent.on(events.infiniteEditHandler, this.infiniteEditHandler, this);
        this.parent.on(events.virtualScrollAddActionBegin, this.infiniteAddActionBegin, this);
        this.parent.on(events.modelChanged, this.modelChanged, this);
        this.parent.on(events.refreshInfiniteCurrentViewData, this.refreshInfiniteCurrentViewData, this);
        this.actionBeginFunction = this.actionBegin.bind(this);
        this.actionCompleteFunction = this.actionComplete.bind(this);
        this.parent.on(events.deleteComplete, this.deleteComplate, this);
        this.parent.addEventListener(events.actionBegin, this.actionBeginFunction);
        this.parent.addEventListener(events.actionComplete, this.actionCompleteFunction);
    }

    /**
     * @returns {void}
     * @hidden
     */
    public removeEventListener(): void {
        if (this.parent.isDestroyed) { return; }
        this.parent.off(events.dataReady, this.onDataReady);
        this.parent.off(events.dataSourceModified, this.dataSourceModified);
        this.parent.off(events.infinitePageQuery, this.infinitePageQuery);
        this.parent.off(events.infiniteScrollHandler, this.infiniteScrollHandler);
        this.parent.off(events.beforeCellFocused, this.infiniteCellFocus);
        this.parent.off(events.appendInfiniteContent, this.appendInfiniteRows);
        this.parent.off(events.removeInfiniteRows, this.removeInfiniteCacheRows);
        this.parent.off(events.resetInfiniteBlocks, this.resetInfiniteBlocks);
        this.parent.off(events.setInfiniteCache, this.setCache);
        this.parent.off(events.initialCollapse, this.ensureIntialCollapse);
        this.parent.off(events.keyPressed, this.infiniteCellFocus);
        this.parent.off(events.infiniteShowHide, this.setDisplayNone);
        this.parent.off(events.virtualScrollEditActionBegin, this.editActionBegin);
        this.parent.off(events.getVirtualData, this.getVirtualInfiniteData);
        this.parent.off(events.editReset, this.resetInfiniteEdit);
        this.parent.off(events.virtualScrollEditSuccess, this.infiniteEditSuccess);
        this.parent.off(events.refreshVirtualCache, this.refreshInfiniteCache);
        this.parent.off(events.infiniteEditHandler, this.infiniteEditHandler);
        this.parent.off(events.virtualScrollAddActionBegin, this.infiniteAddActionBegin);
        this.parent.off(events.modelChanged, this.modelChanged);
        this.parent.off(events.refreshInfiniteCurrentViewData, this.refreshInfiniteCurrentViewData);
        this.parent.removeEventListener(events.actionBegin, this.actionBeginFunction);
        this.parent.removeEventListener(events.actionComplete, this.actionCompleteFunction);
    }

    private updateCurrentViewData(): void {
        const gObj: IGrid = this.parent;
        if (gObj.groupSettings.columns.length) {
            return;
        }
        const keys: string[] = Object.keys(this.infiniteCurrentViewData);
        gObj.currentViewData = [];
        const page: number = gObj.pageSettings.currentPage;
        const isCache: boolean = gObj.infiniteScrollSettings.enableCache;
        const blocks: number = gObj.infiniteScrollSettings.maxBlocks;
        const isMiddlePage: boolean = isCache && (page > blocks || (this.isUpScroll && page > 1));
        const start: number = isMiddlePage ? this.isUpScroll ? page : (page - blocks) + 1 : 1;
        const end: number = isMiddlePage ? (start + blocks) - 1 : isCache ? blocks : keys.length;
        for (let i: number = start; i <= end; i++) {
            if (this.infiniteCurrentViewData[i]) {
                gObj.currentViewData = gObj.currentViewData.concat(this.infiniteCurrentViewData[i]);
            }
        }
    }

    private refreshInfiniteCurrentViewData(e: { args: NotifyArgs, data: Object[] }): void {
        const page: number = this.parent.pageSettings.currentPage;
        const size: number = this.parent.pageSettings.pageSize;
        const blocks: number = this.parent.infiniteScrollSettings.initialBlocks;
        const keys: string[] = Object.keys(this.infiniteCurrentViewData);
        const cache: boolean = this.parent.infiniteScrollSettings.enableCache;
        if (!this.parent.groupSettings.columns.length) {
            const isAdd: boolean = e.args.requestType === 'save';
            const isDelete: boolean = e.args.requestType === 'delete';
            if (!cache && (isAdd || isDelete)) {
                if (isAdd) {
                    this.infiniteCurrentViewData[1] = e.data.concat(this.infiniteCurrentViewData[1]);
                } else {
                    this.infiniteCurrentViewData[keys[keys.length - 1]].push(e.data[0]);
                }
            } else {
                if (blocks > 1 && e.data.length === (blocks * size)) {
                    this.setInitialCache(e.data.slice() as Row<Column>[], {}, cache && e.args.requestType === 'delete', true);
                } else {
                    this.infiniteCurrentViewData[page] = e.data.slice();
                }
            }
        }
    }

    private deleteComplate(): void {
        if (this.parent.isFrozenGrid() && !this.parent.infiniteScrollSettings.enableCache) {
            (<{ refreshScrollOffset?: Function }>this.parent.contentModule).refreshScrollOffset();
        }
    }

    private modelChanged(args: InfiniteScrollArgs): void {
        if (args.requestType !== 'infiniteScroll' && (args.requestType === 'delete' || this.requestType === 'add')) {
            const rows: Element[] = this.parent.getRows();
            this.firstIndex = parseInt(rows[0].getAttribute(literals.ariaRowIndex), 10);
            this.firstBlock = Math.ceil((this.firstIndex + 1) / this.parent.pageSettings.pageSize);
            this.lastIndex = parseInt(rows[rows.length - 1].getAttribute(literals.ariaRowIndex), 10);
            if (args.requestType === 'delete') {
                const rowObj: Row<Column>[] = this.parent.getRowsObject();
                args.startIndex = this.parent.infiniteScrollSettings.enableCache
                    ? (this.firstBlock - 1) * this.parent.pageSettings.pageSize : rowObj[rowObj.length - 1].index;
            } else {
                args.startIndex = this.firstIndex;
            }
            if (!this.parent.infiniteScrollSettings.enableCache
                && this.parent.pageSettings.currentPage === this.maxPage && args.requestType === 'delete') {
                this.isLastPage = true;
                this.lastIndex = this.lastIndex - 1;
            }
        }
    }

    private infiniteAddActionBegin(args: { startEdit: boolean }): void {
        if (this.isNormaledit) {
            this.isAdd = true;
            if (this.parent.infiniteScrollSettings.enableCache) {
                if (!Object.keys(this.emptyRowData).length) {
                    this.createEmptyRowdata();
                }
                if (this.parent.pageSettings.currentPage > 1) {
                    args.startEdit = false;
                    this.resetInfiniteBlocks({}, true);
                    this.makeRequest({ currentPage: 1 });
                }
            }
        }
    }

    private infiniteEditHandler(args: { e: InfiniteScrollArgs, result: Object[] }): void {
        if (!this.parent.infiniteScrollSettings.enableCache && (args.e.requestType === 'delete'
            || (args.e.requestType === 'save' && this.requestType === 'add'))) {
            const frozenCols: boolean = this.parent.isFrozenGrid();
            const rowElms: Element[] = this.parent.getRows();
            const rows: Row<Column>[] = this.parent.getRowsObject();
            if (this.ensureRowAvailability(rows, args.result[0])) {
                this.resetRowIndex(rows, args.e, rowElms, this.requestType === 'add', true);
                if (frozenCols) {
                    const rows: Row<Column>[] = this.parent.getMovableRowsObject();
                    this.resetRowIndex(rows, args.e, this.parent.getMovableDataRows(), this.requestType === 'add');
                    if (this.parent.getFrozenMode() === literals.leftRight) {
                        const frRows: Row<Column>[] = this.parent.getFrozenRightRowsObject();
                        this.resetRowIndex(frRows, args.e, this.parent.getFrozenRightRows(), this.requestType === 'add');
                    }
                }
                if (!this.isLastPage) {
                    this.createRow(rows, args);
                } else {
                    this.isLastPage = false;
                    this.parent.pageSettings.currentPage = this.maxPage;
                    if (this.parent.selectionModule.index < this.parent.frozenRows) {
                        remove(rowElms[this.parent.frozenRows - 1]);
                        this.createRow([rows[this.parent.frozenRows - 1]], args, false, true);
                        if (frozenCols) {
                            const movableRows: Element[] = this.parent.getMovableDataRows();
                            remove(movableRows[this.parent.frozenRows]);
                            this.createRow([this.parent.getMovableRowsObject()[this.parent.frozenRows - 1]], args, true, true);
                            if (this.parent.getFrozenMode() === literals.leftRight) {
                                const rightRows: Element[] = this.parent.getFrozenRightDataRows();
                                remove(rightRows[this.parent.frozenRows]);
                                this.createRow(
                                    [this.parent.getFrozenRightRowsObject()[this.parent.frozenRows - 1]], args, false, true, true
                                );
                            }
                        }
                        setRowElements(this.parent);
                    }
                }
            }
            this.parent.hideSpinner();
            if (this.requestType === 'delete') {
                this.parent.notify(events.deleteComplete, args.e);
            } else {
                this.parent.notify(events.saveComplete, args.e);
            }
        }
        this.parent.notify(events.freezeRender, { case: 'refreshHeight' });
    }

    private createRow(
        rows: Row<Column>[], args: { e: InfiniteScrollArgs, result: Object[] },
        isMovable?: boolean, isFrozenRows?: boolean, isFrozenRight?: boolean): void {
        const row: Row<Column>[] = !isFrozenRows ? this.generateRows(args.result, args.e) : rows;
        const rowRenderer: RowRenderer<Column> = new RowRenderer<Column>(this.serviceLocator, null, this.parent);
        let tbody: HTMLElement;
        if (isFrozenRight) {
            tbody = this.parent.element.querySelector('.e-frozen-right-content').querySelector( literals.tbody);
        } else {
            tbody = !this.parent.isFrozenGrid() ? this.parent.getContent().querySelector( literals.tbody) : isMovable
                ? this.parent.getMovableVirtualContent().querySelector( literals.tbody)
                : this.parent.getFrozenVirtualContent().querySelector( literals.tbody);
        }
        if (this.parent.frozenRows) {
            tbody = isFrozenRows && this.requestType !== 'add' || !isFrozenRows && this.requestType === 'add'
                ? !this.parent.isFrozenGrid() ? this.parent.getHeaderContent().querySelector( literals.tbody)
                    : isMovable ? this.parent.getMovableVirtualHeader().querySelector( literals.tbody)
                        : isFrozenRight ? this.parent.element.querySelector('.e-frozen-right-header').querySelector( literals.tbody)
                            : this.parent.getFrozenVirtualHeader().querySelector( literals.tbody) : tbody;
        }
        const notifyArgs: {
            rows: Row<Column>[], cancel: boolean, args: { e: InfiniteScrollArgs, result: Object[] },
            isMovable?: boolean, isFrozenRows?: boolean, isFrozenRight?: boolean, row: Row<Column>[]
        } = {
            rows: rows, cancel: false, args: args, isMovable: isMovable,
            isFrozenRows: isFrozenRows, isFrozenRight: isFrozenRows, row: row
        };
        this.parent.notify(events.infiniteCrudCancel, notifyArgs);
        if (!notifyArgs.cancel) {
            for (let i: number = row.length - 1; i >= 0; i--) {
                if (this.requestType === 'delete') {
                    tbody.appendChild(rowRenderer.render(row[i], this.parent.getColumns()));
                } else {
                    tbody.insertBefore(rowRenderer.render(row[i], this.parent.getColumns()), tbody.firstElementChild);
                }
            }
        }
        if (!isFrozenRows && this.parent.frozenRows
            && (this.parent.selectionModule.index < this.parent.frozenRows || this.requestType === 'add')) {
            const rowElems: Element[] = isMovable ? this.parent.getMovableDataRows() : isFrozenRight ? this.parent.getFrozenRightDataRows()
                : this.parent.getRows();
            const index: number = (isMovable || isFrozenRight) && this.requestType === 'add'
                ? this.parent.frozenRows : this.parent.frozenRows - 1;
            remove(rowElems[index]);
            this.createRow([rows[this.parent.frozenRows - 1]], args, isMovable, true, isFrozenRight);
        }
        if (!this.parent.infiniteScrollSettings.enableCache && !isFrozenRows) {
            if (isFrozenRight) {
                setRowElements(this.parent);
                (<{ rightFreezeRows?: Row<Column>[] }>this.parent.contentModule).rightFreezeRows = this.requestType === 'add'
                    ? row.concat(rows) : rows.concat(row);
            } else if (!this.parent.isFrozenGrid() || isMovable) {
                setRowElements(this.parent);
                (<{ visibleRows?: Row<Column>[] }>this.parent.contentModule).visibleRows = this.requestType === 'add'
                    ? row.concat(rows) : rows.concat(row);
                if (this.parent.getFrozenMode() === literals.leftRight) {
                    this.createRow(this.parent.getFrozenRightRowsObject(), args, false, false, true);
                }
            } else {
                (<{ visibleFrozenRows?: Row<Column>[] }>this.parent.contentModule).visibleFrozenRows = this.requestType === 'add'
                    ? row.concat(rows) : rows.concat(row);
                this.createRow(this.parent.getMovableRowsObject(), args, true);
            }
        }
    }

    private ensureRowAvailability(rows: Row<Column>[], data: Object): boolean {
        let resume: boolean = true;
        if (this.parent.frozenRows && !this.parent.infiniteScrollSettings.enableCache
            && this.parent.sortSettings.columns && this.requestType === 'add') {
            const key: string = this.parent.getPrimaryKeyFieldNames()[0];
            for (let i: number = 0; i < rows.length; i++) {
                if (rows[i].data[key] === data[key]) {
                    resume = false;
                    break;
                }
            }
        }
        return resume;
    }

    private generateRows(data: Object[], args: NotifyArgs): Row<Column>[] {
        return this.rowModelGenerator.generateRows(data, args);
    }

    private resetRowIndex(rows: Row<Column>[], args: NotifyArgs, rowElms: Element[], isAdd: boolean, isFrozen?: boolean): void {
        const keyField: string = this.parent.getPrimaryKeyFieldNames()[0];
        const isRemove: boolean = !(rowElms.length % this.parent.pageSettings.pageSize);
        if (isAdd) {
            if (isRemove) {
                if (isFrozen && !this.parent.groupSettings.columns.length) {
                    this.swapCurrentViewData(1, true);
                }
                remove(rowElms[rows.length - 1]);
                rowElms.splice(rows.length - 1, 1);
                rows.splice(rows.length - 1, 1);
            }
        } else {
            rows.filter((e: Row<Column>, index: number) => {
                if (e.data[keyField] === (<{ data?: Object[] }>args).data[0][keyField]) {
                    if (isFrozen && !this.parent.groupSettings.columns.length) {
                        const page: number = Math.ceil((index + 1) / this.parent.pageSettings.pageSize);
                        this.resetInfiniteCurrentViewData(page, index);
                    }
                    rows.splice(index, 1);
                    remove(rowElms[index]);
                    rowElms.splice(index, 1);
                }
            });
        }
        const startIndex: number = isAdd ? 1 : 0;
        resetRowIndex(this.parent, rows, rowElms as HTMLTableRowElement[], startIndex);
    }

    private resetInfiniteCurrentViewData(page: number, index: number): void {
        index = index - ((page - 1) * this.parent.pageSettings.pageSize);
        this.infiniteCurrentViewData[page].splice(index, 1);
        this.swapCurrentViewData(page, false);
    }

    private swapCurrentViewData(page: number, isAdd: boolean): void {
        const keys: string[] = Object.keys(this.infiniteCurrentViewData);
        const end: number = isAdd ? keys.length + 1 : keys.length;
        for (let i: number = page; i < end; i++) {
            if (this.infiniteCurrentViewData[i + 1]) {
                const pageIndex: number = isAdd ? i : i + 1;
                const index: number = isAdd ? this.infiniteCurrentViewData[i].length - 1 : 0;
                const data: Object[] = this.infiniteCurrentViewData[pageIndex].splice(index, 1);
                if (isAdd) {
                    this.infiniteCurrentViewData[i + 1] = data.concat(this.infiniteCurrentViewData[i + 1]);
                    if ((i + 1) === end - 1) {
                        this.infiniteCurrentViewData[i + 1].splice(this.infiniteCurrentViewData[i + 1].length - 1, 1);
                    }
                } else {
                    this.infiniteCurrentViewData[i].push(data[0]);
                }
            }
        }
        this.updateCurrentViewData();
    }

    private setDisplayNone(args: { visible: string, index: number, isFreeze: boolean }): void {
        if (this.parent.infiniteScrollSettings.enableCache) {
            const frozenCols: boolean = this.parent.isFrozenGrid();
            const keys: string[] = frozenCols ? Object.keys(this.infiniteFrozenCache) : Object.keys(this.infiniteCache);
            for (let i: number = 1; i <= keys.length; i++) {
                const cache: Row<Column>[] = frozenCols ? args.isFreeze ? this.infiniteFrozenCache[i][0]
                    : this.infiniteFrozenCache[i][1] : this.infiniteCache[i];
                cache.filter((e: Row<Column>) => {
                    e.cells[args.index].visible = args.visible === '';
                });
            }
            this.resetContentModuleCache(frozenCols ? this.infiniteFrozenCache : this.infiniteCache);
        }
    }

    private refreshInfiniteCache(data: Object): void {
        this.getEditedRowObject().data = data;
    }

    private getEditedRowObject(): Row<Column> {
        const rowObjects: Row<Column>[] = this.parent.getRowsObject();
        let editedrow: Row<Column>;
        for (let i: number = 0; i < rowObjects.length; i++) {
            if (rowObjects[i].index === this.editRowIndex) {
                editedrow = rowObjects[i];
            }
        }
        return editedrow;
    }

    private infiniteEditSuccess(args?: EditArgs): void {
        if (this.isNormaledit) {
            if (!this.isAdd && args.data) {
                this.updateCurrentViewRecords(args.data);
            }
            this.isAdd = false;
        }
    }

    private updateCurrentViewRecords(data: Object): void {
        const index: number = getEditedDataIndex(this.parent, data);
        if (!isNullOrUndefined(index)) {
            this.parent.getCurrentViewRecords()[index] = data;
        }
    }

    private actionBegin(args: NotifyArgs): void {
        if (args.requestType === 'add' || args.requestType === 'delete') {
            this.requestType = args.requestType;
        }
        if (this.parent.isFrozenGrid() && !args.cancel && args.requestType === 'searching'
            || args.requestType === 'sorting' || args.requestType === 'filtering') {
            this.isInitialRender = true;
        }
    }

    private actionComplete(args: NotifyArgs): void {
        if (args.requestType === 'delete' || args.requestType === 'save' || args.requestType === 'cancel') {
            this.requestType = this.empty as Action;
            this.isCancel = args.requestType === 'cancel' || args.requestType === 'save';
            this.isAdd = this.isEdit = false;
            if (this.isNormaledit) {
                this.editRowIndex = this.empty as number;
                this.virtualInfiniteData = {};
                (<{ previousVirtualData?: Object }>this.parent.editModule).previousVirtualData = {};
            }
        }
    }

    private resetInfiniteEdit(): void {
        if (this.parent.enableInfiniteScrolling && this.isNormaledit) {
            if ((this.parent.editSettings.allowEditing && this.isEdit) || (this.parent.editSettings.allowAdding && this.isAdd)) {
                this.parent.isEdit = true;
            }
        }
    }

    private getVirtualInfiniteData(data: { virtualData: Object, isAdd: boolean, isCancel: boolean }): void {
        data.virtualData = this.virtualInfiniteData;
        data.isAdd = this.isAdd;
        data.isCancel = this.isCancel;
    }

    private editActionBegin(e: { data: Object, index: number }): void {
        this.isEdit = true;
        this.editRowIndex = e.index;
        const rowObject: Object = extend({}, this.getEditedRowObject().data);
        e.data = Object.keys(this.virtualInfiniteData).length ? this.virtualInfiniteData : rowObject;
    }

    private dataSourceModified(): void {
        this.resetInfiniteBlocks({ requestType: this.empty as Action }, true);
    }

    private onDataReady(e: NotifyArgs): void {
        if (!isNullOrUndefined(e.count)) {
            this.maxPage = Math.ceil(e.count / this.parent.pageSettings.pageSize);
        }
    }

    private ensureIntialCollapse(isExpand: boolean): void {
        this.isInitialCollapse = !isExpand;
    }

    private infiniteScrollHandler(e: { target: HTMLElement, isLeft: boolean }): void {
        this.restoreInfiniteEdit();
        this.restoreInfiniteAdd();
        const targetEle: HTMLElement = e.target as HTMLElement;
        const isInfinite: boolean = targetEle.classList.contains(literals.content);
        if (isInfinite && this.parent.enableInfiniteScrolling && !e.isLeft) {
            const scrollEle: Element = this.parent.getContent().firstElementChild;
            this.prevScrollTop = scrollEle.scrollTop;
            const rows: Element[] = this.parent.getRows();
            const index: number = parseInt(rows[rows.length - 1].getAttribute(literals.ariaRowIndex), 10) + 1;
            const prevPage: number = this.parent.pageSettings.currentPage;
            let args: InfiniteScrollArgs;
            const offset: number = targetEle.scrollHeight - targetEle.scrollTop;
            const round: number = Math.round(targetEle.scrollHeight - targetEle.scrollTop);
            const floor: number = offset < targetEle.clientHeight ? Math.ceil(offset) : Math.floor(offset);
            const isBottom: boolean = (floor === targetEle.clientHeight || round === targetEle.clientHeight);
            if (this.isScroll && isBottom && (this.parent.pageSettings.currentPage <= this.maxPage - 1 || this.enableContinuousScroll)) {
                if (this.parent.infiniteScrollSettings.enableCache) {
                    this.isUpScroll = false;
                    this.isDownScroll = true;
                }
                const rows: Element[] = [].slice.call(scrollEle.querySelectorAll('.e-row:not(.e-addedrow)'));
                const row: Element = rows[rows.length - 1];
                const rowIndex: number = parseInt(row.getAttribute(literals.ariaRowIndex), 10);
                this.parent.pageSettings.currentPage = Math.ceil(rowIndex / this.parent.pageSettings.pageSize) + 1;
                args = {
                    requestType: 'infiniteScroll',
                    currentPage: this.parent.pageSettings.currentPage,
                    prevPage: prevPage,
                    startIndex: index,
                    direction: 'down'
                };
                this.makeRequest(args);
            }

            if (this.isScroll && this.parent.infiniteScrollSettings.enableCache && targetEle.scrollTop === 0
                && this.parent.pageSettings.currentPage !== 1) {
                if (this.parent.infiniteScrollSettings.enableCache) {
                    this.isDownScroll = false;
                    this.isUpScroll = true;
                }
                const row: Element = [].slice.call(scrollEle.getElementsByClassName(literals.row));
                const rowIndex: number = parseInt(row[this.parent.pageSettings.pageSize - 1].getAttribute(literals.ariaRowIndex), 10);
                const startIndex: number = parseInt(row[0].getAttribute(literals.ariaRowIndex), 10) - this.parent.pageSettings.pageSize;
                this.parent.pageSettings.currentPage = Math.ceil(rowIndex / this.parent.pageSettings.pageSize) - 1;
                if (this.parent.pageSettings.currentPage) {
                    args = {
                        requestType: 'infiniteScroll',
                        currentPage: this.parent.pageSettings.currentPage,
                        prevPage: prevPage,
                        startIndex: startIndex,
                        direction: 'up'
                    };
                    this.makeRequest(args);
                }
            }
            if (this.parent.infiniteScrollSettings.enableCache && !this.isScroll && isNullOrUndefined(args)) {
                if (this.isDownScroll || this.isUpScroll) {
                    scrollEle.scrollTop = this.top;
                }
            }
        }
    }

    private makeRequest(args: InfiniteScrollArgs): void {
        if (this.parent.pageSettings.currentPage !== args.prevPage) {
            if (this.parent.pageSettings.currentPage <= this.maxPage) {
                this.isInfiniteScroll = true;
                if (isNullOrUndefined(this.infiniteCache[args.currentPage])) {
                    setTimeout(
                        () => {
                            this.getVirtualInfiniteEditedData();
                            this.parent.notify('model-changed', args);
                        },
                        100);
                } else {
                    setTimeout(
                        () => {
                            this.getVirtualInfiniteEditedData();
                            this.parent.notify(events.refreshInfiniteModeBlocks, args);
                        },
                        100);
                }
            } else {
                this.parent.pageSettings.currentPage = this.maxPage;
            }
        }
    }

    private infinitePageQuery(query: Query): void {
        if (this.initialRender) {
            this.initialRender = false;
            this.intialPageQuery(query);
        } else {
            if (!this.isInfiniteScroll && (this.requestType === 'delete' || this.requestType === 'add')) {
                this.editPageQuery(query);
            } else {
                query.page(this.parent.pageSettings.currentPage, this.parent.pageSettings.pageSize);
            }
        }
    }

    private editPageQuery(query: Query): void {
        const initialBlocks: number = this.parent.infiniteScrollSettings.initialBlocks;
        const isCache: boolean = this.parent.infiniteScrollSettings.enableCache;
        if (isCache) {
            this.infiniteCache = {};
            this.infiniteFrozenCache = {};
            this.infiniteCurrentViewData = {};
            query.skip(this.firstIndex);
            query.take(initialBlocks * this.parent.pageSettings.pageSize);
        } else {
            if (this.parent.editSettings.mode === 'Dialog') {
                this.parent.clearSelection();
            }
            const index: number = this.requestType === 'delete' ? this.lastIndex : this.firstIndex;
            query.skip(index);
            query.take(1);
        }
    }

    private intialPageQuery(query: Query): void {
        if (this.parent.infiniteScrollSettings.enableCache
            && this.parent.infiniteScrollSettings.initialBlocks > this.parent.infiniteScrollSettings.maxBlocks) {
            this.parent.infiniteScrollSettings.initialBlocks = this.parent.infiniteScrollSettings.maxBlocks;
        }
        const pageSize: number = this.parent.pageSettings.pageSize * this.parent.infiniteScrollSettings.initialBlocks;
        query.page(1, pageSize);
    }

    private infiniteCellFocus(e: CellFocusArgs): void {
        if (e.byKey && (e.keyArgs.action === 'upArrow' || e.keyArgs.action === 'downArrow')) {
            this.pressedKey = e.keyArgs.action;
            const ele: Element = document.activeElement;
            const rowIndex: number = parseInt(ele.parentElement.getAttribute(literals.ariaRowIndex), 10);
            const scrollEle: Element = this.parent.getContent().firstElementChild;
            this.rowIndex = e.keyArgs.action === 'downArrow' ? rowIndex + 1 : rowIndex - 1;
            this.cellIndex = parseInt(ele.getAttribute(literals.ariaColIndex), 10);
            const row: Element = this.parent.getRowByIndex(rowIndex);
            const visibleRowCount: number = Math.floor((scrollEle as HTMLElement).offsetHeight / this.parent.getRowHeight());
            if (!row || ensureLastRow(row, this.parent) || ensureFirstRow(row, this.rowTop)) {
                const height: number = row ? row.getBoundingClientRect().height : this.parent.getRowHeight();
                if (!this.parent.infiniteScrollSettings.enableCache) {
                    if (e.keyArgs.action === 'downArrow' && (ensureLastRow(row, this.parent) || !row)) {
                        const nTop: number = (this.rowIndex - visibleRowCount) * height;
                        const oTop: number = scrollEle.scrollTop + this.parent.getRowHeight();
                        scrollEle.scrollTop = nTop < oTop ? oTop : nTop;
                    }
                    if (e.keyArgs.action === 'upArrow' && ensureFirstRow(row, this.rowTop)) {
                        scrollEle.scrollTop = this.rowIndex * height;
                    }
                }
            } else {
                this.pressedKey = this.empty as string;
            }
        } else if ((e as KeyboardEventArgs).key === 'PageDown' || (e as KeyboardEventArgs).key === 'PageUp') {
            this.pressedKey = (e as KeyboardEventArgs).key;
        }
    }

    private createEmptyRowdata(): void {
        this.parent.getColumns().filter((e: Column) => {
            this.emptyRowData[e.field] = this.empty;
        });
    }

    private getVirtualInfiniteEditedData(): void {
        const editForm: Element = this.parent.element.querySelector('.' + literals.editedRow);
        const addForm: Element = this.parent.element.querySelector('.' + literals.addedRow);
        const gridForm: Element = this.parent.element.querySelector('.e-gridform');
        if (this.parent.infiniteScrollSettings.enableCache && (editForm || addForm)) {
            const rowData: Object = editForm ? extend({}, this.getEditedRowObject().data)
                : extend({}, this.emptyRowData);
            this.virtualInfiniteData = this.parent.editModule.getCurrentEditedData(gridForm, rowData);
            if (this.parent.isFrozenGrid()) {
                this.virtualInfiniteData = this.parent.editModule
                    .getCurrentEditedData(this.parent.getMovableVirtualContent().querySelector('.e-gridform'), rowData);
            }
        }
    }

    private restoreInfiniteEdit(): void {
        const content: HTMLElement = this.parent.getContent().firstElementChild as HTMLElement;
        const frozenEdit: boolean = this.parent.frozenRows ? this.editRowIndex >= this.parent.frozenRows : true;
        if (this.isNormaledit && this.parent.infiniteScrollSettings.enableCache && frozenEdit) {
            if (this.parent.editSettings.allowEditing && !isNullOrUndefined(this.editRowIndex)) {
                const row: HTMLTableRowElement = this.parent.getRowByIndex(this.editRowIndex) as HTMLTableRowElement;
                if (Object.keys(this.virtualInfiniteData).length && row && !this.parent.getContent().querySelector('.' + literals.editedRow)) {
                    const top: number = row.getBoundingClientRect().top;
                    if (top < content.offsetHeight && top > this.parent.getRowHeight()) {
                        this.parent.isEdit = false;
                        this.parent.editModule.startEdit(row);
                    }
                }
            }
        }
    }

    private restoreInfiniteAdd(): void {
        const content: Element = this.parent.getContent().firstElementChild;
        if (this.parent.getCurrentViewRecords().length && this.parent.getRowByIndex(0) && this.isNormaledit &&
            this.parent.infiniteScrollSettings.enableCache && this.isAdd && !content.querySelector('.' + literals.addedRow)) {
            const isTop: boolean = content.scrollTop < this.parent.getRowHeight();
            if (isTop) {
                this.parent.isEdit = false;
                this.parent.addRecord();
            }
        }
    }

    private appendInfiniteRows(e: {
        tbody: Element, frag: DocumentFragment, args: InfiniteScrollArgs,
        rows: Row<Column>[], rowElements: Element[], visibleRows: Row<Column>[],
        tableName: freezeTable
    }): void {
        const frozenCols: boolean = this.parent.isFrozenGrid();
        const scrollEle: Element = this.parent.getContent().firstElementChild;
        const isInfiniteScroll: boolean = this.parent.enableInfiniteScrolling && e.args.requestType === 'infiniteScroll';
        const isMovable: boolean = this.parent.getFrozenMode() === literals.leftRight &&  e.tableName === 'movable';
        if ((isInfiniteScroll && !e.args.isFrozen && !isMovable) || !isInfiniteScroll) {
            if (isInfiniteScroll && e.args.direction === 'up') {
                e.tbody.insertBefore(e.frag, e.tbody.firstElementChild);
            } else {
                e.tbody.appendChild(e.frag);
            }
        }
        if (!frozenCols) {
            (this.parent as Grid).contentModule.getTable().appendChild(e.tbody);
            this.updateCurrentViewData();
        } else {
            if (isInfiniteScroll) {
                if (e.tableName === literals.frozenLeft || (this.parent.getFrozenMode() === 'Right' && e.tableName === literals.frozenRight)) {
                    this.frozenFrag = e.frag;
                } else if (this.parent.getFrozenMode() === literals.leftRight && e.tableName === 'movable') {
                    this.movableFrag = e.frag;
                } else {
                    const tbody: Element = this.parent.getFrozenVirtualContent().querySelector( literals.tbody);
                    if (e.args.direction === 'up') {
                        tbody.insertBefore(this.frozenFrag, tbody.firstElementChild);
                    } else {
                        tbody.appendChild(this.frozenFrag);
                    }
                    if (e.tableName === literals.frozenRight) {
                        this.parent.getMovableVirtualContent().querySelector( literals.tbody).appendChild(this.movableFrag);
                        this.parent.element.querySelector('.e-frozen-right-content').querySelector( literals.tbody).appendChild(e.frag);
                    } else {
                        this.parent.getMovableVirtualContent().querySelector('.' + literals.table).appendChild(e.tbody);
                    }
                    (<{ refreshScrollOffset?: Function }>this.parent.contentModule).refreshScrollOffset();
                    this.updateCurrentViewData();
                }
            } else {
                let table: Element;
                if (e.tableName === literals.frozenLeft) {
                    table = this.parent.getFrozenVirtualContent().querySelector('.' + literals.table);
                } else if (e.tableName === 'movable') {
                    table = this.parent.getMovableVirtualContent().querySelector('.' + literals.table);
                    if (this.parent.getFrozenMode() !== literals.leftRight) {
                        (<{ refreshScrollOffset?: Function }>this.parent.contentModule).refreshScrollOffset();
                        this.updateCurrentViewData();
                    }
                } else {
                    table = this.parent.element.querySelector('.e-frozen-right-content').querySelector('.' + literals.table);
                    if (this.parent.getFrozenMode() === literals.leftRight) {
                        (<{ refreshScrollOffset?: Function }>this.parent.contentModule).refreshScrollOffset();
                        this.updateCurrentViewData();
                    }
                }
                table.appendChild(e.tbody);
                this.widthService.refreshFrozenScrollbar();
            }
        }
        if (this.isInitialRender && !e.args.isFrozen) {
            this.isInitialRender = false;
            this.parent.scrollModule.setHeight();
        }
        if (!e.args.isFrozen) {
            this.rowTop = !this.rowTop ? this.parent.getRows()[0].getBoundingClientRect().top : this.rowTop;
            if (isInfiniteScroll) {
                if (this.parent.infiniteScrollSettings.enableCache && this.isRemove) {
                    scrollEle.scrollTop = this.top;
                }
                setRowElements(this.parent);
                this.selectNewRow(e.tbody, e.args.startIndex);
                this.pressedKey = undefined;
            }
            this.restoreInfiniteAdd();
            this.isScroll = true;
        }
        this.isInfiniteScroll = false;
    }

    private selectNewRow(tbody: Element, startIndex: number): void {
        const row: Element = this.parent.getRowByIndex(this.rowIndex);
        if (this.keys.some((value: string) => value === this.pressedKey)) {
            if (this.pressedKey === 'downArrow' || (this.parent.infiniteScrollSettings.enableCache && this.pressedKey === 'upArrow')) {
                setTimeout(
                    () => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const target: any = (<{ cells?: HTMLElement[] }>row).cells[0];
                        target.focus({ preventScroll: true });
                        this.parent.selectRow(this.rowIndex);
                        this.parent.getContent().firstElementChild.scrollTop += this.parent.getRowHeight();
                    },
                    0);
            }
            if (this.pressedKey === 'PageDown') {
                const row: Element = this.parent.getRowByIndex(startIndex);
                if (row) {
                    (<{ cells?: HTMLElement[] }>row).cells[0].focus();
                }
            }
            if (this.pressedKey === 'PageUp') {
                (<{ cells?: HTMLElement[] }>tbody.querySelector('.' + literals.row)).cells[0].focus();
            }
        }
    }

    private removeInfiniteCacheRows(e: { args: InfiniteScrollArgs }): void {
        const isInfiniteScroll: boolean = this.parent.enableInfiniteScrolling && e.args.requestType === 'infiniteScroll';
        if (!e.args.isFrozen && isInfiniteScroll && this.parent.infiniteScrollSettings.enableCache && this.isRemove) {
            const rows: Element[] = [].slice.call(this.parent.getContentTable().getElementsByClassName(literals.row));
            if (e.args.direction === 'down') {
                if (this.parent.allowGrouping && this.parent.groupSettings.columns.length) {
                    const captionRows: Element[] = [].slice.call(this.parent.getContentTable().querySelectorAll('tr'));
                    this.removeCaptionRows(captionRows, e.args);
                }
                const addRowCount: number = this.parent.element.querySelector('.' + literals.addedRow) ? 0 : 1;
                this.removeTopRows(rows, this.parent.pageSettings.pageSize - addRowCount);
            }
            if (e.args.direction === 'up') {
                if (this.parent.allowGrouping && this.parent.groupSettings.columns.length) {
                    const captionRows: Element[] = [].slice.call(this.parent.getContentTable().querySelectorAll('tr'));
                    this.removeCaptionRows(captionRows, e.args);
                } else {
                    this.removeBottomRows(rows, rows.length - 1, e.args);
                }
            }
            this.isScroll = false;
            this.top = this.calculateScrollTop(e.args);
        }
    }

    private calculateScrollTop(args: InfiniteScrollArgs): number {
        let top: number = 0;
        const scrollCnt: Element = this.parent.getContent().firstElementChild;
        if (args.direction === 'down') {
            if (this.parent.allowGrouping && this.parent.groupSettings.columns.length && !this.isInitialCollapse) {
                top = this.captionRowHeight();
            }
            const captionRows: Element[] = [].slice.call(this.parent.getContent().firstElementChild.querySelectorAll('tr:not(.e-row)'));
            let captionCount: number = 0;
            if (this.isInitialCollapse && !isNullOrUndefined(captionRows)) {
                captionCount = Math.round((captionRows.length - 1) / this.parent.groupSettings.columns.length);
            }
            const value: number = captionCount ? captionCount
                : this.parent.pageSettings.pageSize * (this.parent.infiniteScrollSettings.maxBlocks - 1);
            let currentViewRowCount: number = 0;
            let i: number = 0;
            while (currentViewRowCount < scrollCnt.clientHeight) {
                i++;
                currentViewRowCount = i * this.parent.getRowHeight();
            }
            i = i - 1;
            top += (value - i) * this.parent.getRowHeight();
        }

        if (args.direction === 'up') {
            if (this.parent.allowGrouping && this.parent.groupSettings.columns.length && !this.isInitialCollapse) {
                top = this.infiniteCache[this.parent.pageSettings.currentPage].length * this.parent.getRowHeight();
            } else if (this.isInitialCollapse) {
                const groupedData: Row<Column>[] = this.infiniteCache[this.parent.pageSettings.currentPage];
                let count: number = 0;
                for (let i: number = 0; i < groupedData.length; i++) {
                    if (groupedData[i].isCaptionRow) {
                        count++;
                    }
                }
                top += Math.round(count / this.parent.groupSettings.columns.length) * this.parent.getRowHeight();
            } else {
                top += (this.parent.pageSettings.pageSize * this.parent.getRowHeight() + getScrollBarWidth());
            }
        }
        return top;
    }

    private captionRowHeight(): number {
        const rows: Element[] = [].slice.call(this.parent.getContent().querySelectorAll('tr:not(.e-row)'));
        return rows.length * this.parent.getRowHeight();
    }

    private removeTopRows(rows: Element[], maxIndx: number): void {
        const frozeCols: boolean = this.parent.isFrozenGrid();
        const frRows: Element[] = this.parent.getFrozenMode() === literals.leftRight
            ? [].slice.call(this.parent.element.querySelector('.e-frozen-right-content').getElementsByClassName(literals.row)) : null;
        const movableRows: Element[] = frozeCols ?
            [].slice.call(this.parent.getMovableVirtualContent().getElementsByClassName(literals.row)) : null;
        for (let i: number = 0; i <= maxIndx; i++) {
            if (this.parent.frozenRows && this.parent.pageSettings.currentPage === this.parent.infiniteScrollSettings.maxBlocks + 1
                && i > (maxIndx - this.parent.frozenRows)) {
                continue;
            }
            remove(rows[i]);
            if (movableRows) {
                remove(movableRows[i]);
            }
            if (frRows) {
                remove(frRows[i]);
            }
        }
    }

    private removeBottomRows(rows: Element[], maxIndx: number, args: InfiniteScrollArgs): void {
        let cnt: number = 0;
        const frozeCols: boolean = this.parent.isFrozenGrid();
        const movableRows: Element[] = frozeCols ?
            [].slice.call(this.parent.getMovableVirtualContent().getElementsByClassName(literals.row)) : null;
        const frRows: Element[] = this.parent.getFrozenMode() === literals.leftRight ?
            [].slice.call(this.parent.element.querySelector('.e-frozen-right-content').getElementsByClassName(literals.row)) : null;
        const pageSize: number = this.parent.pageSettings.pageSize;
        if (!frozeCols && this.infiniteCache[args.prevPage].length < pageSize) {
            cnt = this.parent.pageSettings.pageSize - this.infiniteCache[args.prevPage].length;
        }
        if (frozeCols && this.infiniteFrozenCache[args.prevPage][1].length < pageSize) {
            cnt = this.parent.pageSettings.pageSize - this.infiniteFrozenCache[args.prevPage][1].length;
        }
        for (let i: number = maxIndx; cnt < pageSize; i--) {
            cnt++;
            remove(rows[i]);
            if (movableRows) {
                remove(movableRows[i]);
            }
            if (frRows) {
                remove(frRows[i]);
            }
        }
    }

    private removeCaptionRows(rows: Element[], args: InfiniteScrollArgs): void {
        if (args.direction === 'down') {
            const lastRow: Element = this.parent.getRows()[this.parent.pageSettings.pageSize];
            const lastRowIndex: number = parseInt(lastRow.getAttribute(literals.ariaRowIndex), 10) - 1;
            let k: number = 0;
            for (let i: number = 0; k < lastRowIndex; i++) {
                if (!rows[i].classList.contains(literals.row)) {
                    remove(rows[i]);
                } else {
                    k = parseInt(rows[i].getAttribute(literals.ariaRowIndex), 10);
                }
            }
        }
        if (args.direction === 'up') {
            const rowElements: Element[] = [].slice.call(this.parent.getContent().getElementsByClassName(literals.row));
            const lastIndex: number = parseInt(rowElements[rowElements.length - 1].getAttribute(literals.ariaRowIndex), 10);
            const page: number = Math.ceil(lastIndex / this.parent.pageSettings.pageSize);
            let startIndex: number = 0;
            for (let i: number = this.parent.pageSettings.currentPage + 1; i < page; i++) {
                startIndex += this.infiniteCache[i].length;
            }
            for (let i: number = startIndex; i < rows.length; i++) {
                remove(rows[i]);
            }
        }
    }

    private resetInfiniteBlocks(args: InfiniteScrollArgs, isDataModified?: boolean): void {
        const isInfiniteScroll: boolean = this.parent.enableInfiniteScrolling && args.requestType !== 'infiniteScroll';
        if (!this.initialRender && !isNullOrUndefined((this.parent as Grid).infiniteScrollModule) && isInfiniteScroll) {
            if (this.actions.some((value: string) => value === args.requestType) || isDataModified) {
                const scrollEle: Element = this.parent.getContent().firstElementChild;
                this.initialRender = true;
                scrollEle.scrollTop = 0;
                this.parent.pageSettings.currentPage = 1;
                this.infiniteCache = this.infiniteFrozenCache = {};
                this.infiniteCurrentViewData = {};
                this.resetContentModuleCache({});
                this.isRemove = false;
                this.top = 0;
                this.isInitialMovableRender = true;
                this.isInitialCollapse = false;
                (<{ isRemove?: boolean }>(this.parent as Grid).contentModule).isRemove = this.isRemove;
                (<{ isAddRows?: boolean }>(this.parent as Grid).contentModule).isAddRows = this.isRemove;
                (<{ visibleRows?: Row<Column>[] }>(this.parent as Grid).contentModule).visibleRows = [];
                (<{ visibleFrozenRows?: Row<Column>[] }>(this.parent as Grid).contentModule).visibleFrozenRows = [];
            }
        }
    }

    private setCache(e: { isInfiniteScroll: boolean, modelData: Row<Column>[], args?: InfiniteScrollArgs }): void {
        if (this.parent.enableInfiniteScrolling && this.parent.infiniteScrollSettings.enableCache) {
            const frozeCols: boolean = this.parent.isFrozenGrid();
            const idx: number = e.args.isFrozen ? 1 : 0;
            const isEdit: boolean = e.args.requestType !== 'infiniteScroll'
                && (this.requestType === 'delete' || this.requestType === 'add');
            const currentPage: number = this.parent.pageSettings.currentPage;
            if ((frozeCols && this.isInitialMovableRender) || (!frozeCols && !Object.keys(this.infiniteCache).length) || isEdit) {
                this.isInitialMovableRender = !e.args.isFrozen;
                this.setInitialCache(e.modelData, e.args, isEdit);
            }
            if (!frozeCols && isNullOrUndefined(this.infiniteCache[this.parent.pageSettings.currentPage])) {
                this.infiniteCache[this.parent.pageSettings.currentPage] = e.modelData;
                this.resetContentModuleCache(this.infiniteCache);
            }
            if (frozeCols) {
                if ((idx === 0 && isNullOrUndefined(this.infiniteFrozenCache[currentPage]))
                    || !this.infiniteFrozenCache[currentPage][idx].length) {
                    this.createFrozenCache(currentPage);
                    this.infiniteFrozenCache[currentPage][idx] = e.modelData;
                    if (idx === 1) {
                        this.resetContentModuleCache(this.infiniteFrozenCache);
                    }
                }
            }
            if (e.isInfiniteScroll && !this.isRemove) {
                this.isRemove = (currentPage - 1) % this.parent.infiniteScrollSettings.maxBlocks === 0;
                (<{ isRemove?: boolean }>(this.parent as Grid).contentModule).isRemove = this.isRemove;
            }
        }
    }

    private setInitialCache(data: Row<Column>[], args?: InfiniteScrollArgs, isEdit?: boolean, isCurrentViewData?: boolean): void {
        const frozenCols: boolean = this.parent.isFrozenGrid();
        const idx: number = args.isFrozen ? 1 : 0;
        let k: number = !isEdit ? 1 : this.firstBlock;
        for (let i: number = 1; i <= this.parent.infiniteScrollSettings.initialBlocks; i++) {
            const startIndex: number = (i - 1) * this.parent.pageSettings.pageSize;
            const endIndex: number = i * this.parent.pageSettings.pageSize;
            if (this.parent.allowGrouping && this.parent.groupSettings.columns.length && !isCurrentViewData) {
                this.setInitialGroupCache(data, k, startIndex, endIndex);
            } else {
                if (isCurrentViewData) {
                    this.infiniteCurrentViewData[k] = data.slice(startIndex, endIndex);
                } else {
                    if (frozenCols) {
                        this.createFrozenCache(k);
                        this.infiniteFrozenCache[k][idx] = data.slice(startIndex, endIndex);
                        this.resetContentModuleCache(this.infiniteFrozenCache);
                    } else {
                        this.infiniteCache[k] = data.slice(startIndex, endIndex);
                        this.resetContentModuleCache(this.infiniteCache);
                    }
                }
            }
            k++;
        }
    }

    private createFrozenCache(index: number): void {
        if (!this.infiniteFrozenCache[index]) {
            this.infiniteFrozenCache[index] = [[], []];
        }
    }

    private setInitialGroupCache(data: Row<Column>[], index: number, sIndex: number, eIndex: number): void {
        const pageData: Object[] = [];
        let startIndex: number = 0;
        for (let i: number = 1; i <= Object.keys(this.infiniteCache).length; i++) {
            startIndex += this.infiniteCache[i].length;
        }
        let k: number = sIndex;
        for (let i: number = startIndex; i < data.length && k < eIndex; i++) {
            if (data[i].index < eIndex || data[i].isCaptionRow) {
                k = data[i].isCaptionRow ? k : data[i].index;
                pageData.push(data[i]);
            }
            if (data[i].index >= eIndex || data[i].index === eIndex - 1) {
                break;
            }
        }
        this.infiniteCache[index] = pageData as Row<Column>[];
        this.resetContentModuleCache(this.infiniteCache);
    }

    private resetContentModuleCache(data: { [x: number]: Row<Column>[] } | { [x: number]: Row<Column>[][] }): void {
        (<{ infiniteCache?: { [x: number]: Row<Column>[] } | { [x: number]: Row<Column>[][] } }>(this.parent as Grid).contentModule)
            .infiniteCache = data;
    }

    /**
     * @returns {void}
     * @hidden
     */
    public destroy(): void {
        this.removeEventListener();
    }
}

interface EditArgs {
    data?: Object;
    requestType?: string;
    previousData?: Object;
    selectedRow?: number;
    type?: string;
    promise?: Promise<Object>;
    row?: Element;
}
