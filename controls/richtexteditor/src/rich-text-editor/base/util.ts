/**
 * Defines util methods used by Rich Text Editor.
 */
import { isNullOrUndefined as isNOU, addClass, removeClass, L10n, selectAll, createElement,  } from '@syncfusion/ej2-base';
import { Browser, detach, SanitizeHtmlHelper, extend } from '@syncfusion/ej2-base';
import * as classes from '../base/classes';
import * as model from '../models/items';
import { BaseToolbar } from '../actions/base-toolbar';
import { DropDownButtons } from '../actions/dropdown-buttons';
import { ServiceLocator } from '../services/service-locator';
import { toolsLocale, fontNameLocale, formatsLocale } from '../models/default-locale';
import { IToolsItemConfigs, IRichTextEditor, BeforeSanitizeHtmlArgs } from '../base/interface';
import { IToolbarItems, IDropDownItemModel, ISetToolbarStatusArgs, IToolbarItemModel } from './interface';

const undoRedoItems: string[] = ['Undo', 'Redo'];
const inlineNode: string[] = ['a', 'abbr', 'acronym', 'audio', 'b', 'bdi', 'bdo', 'big', 'br', 'button',
    'canvas', 'cite', 'code', 'data', 'datalist', 'del', 'dfn', 'em', 'embed', 'font', 'i', 'iframe', 'img', 'input',
    'ins', 'kbd', 'label', 'map', 'mark', 'meter', 'noscript', 'object', 'output', 'picture', 'progress',
    'q', 'ruby', 's', 'samp', 'script', 'select', 'slot', 'small', 'span', 'strong', 'strike', 'sub', 'sup', 'svg',
    'template', 'textarea', 'time', 'u', 'tt', 'var', 'video', 'wbr'];
/**
 * @param {string} val - specifies the string value
 * @param {string} items - specifies the value
 * @returns {number} - returns the number value
 * @hidden
 */
export function getIndex(val: string, items: (string | IToolbarItems)[]): number {
    let index: number = -1;
    items.some((item: string, i: number) => {
        if (typeof item === 'string' && val === item.toLocaleLowerCase()) {
            index = i;
            return true;
        }
        return false;
    });
    return index;
}

/**
 * @param {Element} element - specifies the element
 * @param {string} className - specifies the string value
 * @returns {boolean} - returns the boolean value
 * @hidden
 */
export function hasClass(element: Element | HTMLElement, className: string): boolean {
    let hasClass: boolean = false;
    if (element.classList.contains(className)) {
        hasClass = true;
    }
    return hasClass;
}

/**
 * @param {IDropDownItemModel} items - specifies the item model
 * @param {string} value - specifies the string value
 * @param {string} type - specifies the string value
 * @param {string} returnType - specifies the return type
 * @returns {string} - returns the string value
 * @hidden
 */
export function getDropDownValue(items: IDropDownItemModel[], value: string, type: string, returnType: string): string {
    let data: IDropDownItemModel;
    let result: string;
    for (let k: number = 0; k < items.length; k++) {
        if (type === 'value' && items[k].value.toLocaleLowerCase() === value.toLocaleLowerCase()) {
            data = items[k];
            break;
        } else if (type === 'text' && items[k].text.toLocaleLowerCase() === value.toLocaleLowerCase()) {
            data = items[k];
            break;
        } else if (type === 'subCommand' && items[k].subCommand.toLocaleLowerCase() === value.toLocaleLowerCase()) {
            data = items[k];
            break;
        }
    }
    if (!isNOU(data)) {
        switch (returnType) {
        case 'text':
            result = data.text;
            break;
        case 'value':
            result = data.value;
            break;
        case 'iconCss':
            result = data.iconCss;
            break;
        }
    }
    return result;
}

/**
 * @returns {boolean} - returns the boolean value
 * @hidden
 */
export function isIDevice(): boolean {
    let result: boolean = false;
    if (Browser.isDevice && Browser.isIos) {
        result = true;
    }
    return result;
}

/**
 * @param {string} value - specifies the value
 * @returns {string} - returns the string value
 * @hidden
 */
export function getFormattedFontSize(value: string): string {
    if (isNOU(value)) {
        return '';
    }
    return value;
}

/**
 * @param {MouseEvent} e - specifies the mouse event
 * @param {HTMLElement} parentElement - specifies the parent element
 * @param {boolean} isIFrame - specifies the boolean value
 * @returns {number} - returns the number
 * @hidden
 */
export function pageYOffset(e: MouseEvent | Touch, parentElement: HTMLElement, isIFrame: boolean): number {
    let y: number = 0;
    if (isIFrame) {
        y = window.pageYOffset + parentElement.getBoundingClientRect().top + e.clientY;
    } else {
        y = e.pageY;
    }
    return y;
}

/**
 * @param {string} item - specifies the string
 * @param {ServiceLocator} serviceLocator - specifies the service locator
 * @returns {string} - returns the string
 * @hidden
 */
export function getTooltipText(item: string, serviceLocator: ServiceLocator): string {
    const i10n: L10n = serviceLocator.getService<L10n>('rteLocale');
    const itemLocale: string = toolsLocale[item];
    const tooltipText: string = i10n.getConstant(itemLocale);
    return tooltipText;
}

/**
 * @param {ISetToolbarStatusArgs} e - specifies the e element
 * @param {boolean} isPopToolbar - specifies the boolean value
 * @returns {void}
 * @hidden
 */
export function setToolbarStatus(e: ISetToolbarStatusArgs, isPopToolbar: boolean, self: IRichTextEditor): void {
    updateDropDownFontFormatLocale(self);
    const dropDown: DropDownButtons = e.dropDownModule;
    const data: { [key: string]: string | boolean } = <{ [key: string]: string | boolean }>e.args;
    const keys: string[] = Object.keys(e.args);
    for (const key of keys) {
        for (let j: number = 0; j < e.tbItems.length; j++) {
            const item: string = e.tbItems[j].subCommand;
            const itemStr: string = item && item.toLocaleLowerCase();
            if (item && (itemStr === key) || (item === 'UL' && key === 'unorderedlist') || (item === 'OL' && key === 'orderedlist') ||
            (itemStr === 'pre' && key === 'insertcode')) {
                if (typeof data[key] === 'boolean') {
                    if (data[key] === true) {
                        addClass([e.tbElements[j]], [classes.CLS_ACTIVE]);
                    } else {
                        removeClass([e.tbElements[j]], [classes.CLS_ACTIVE]);
                    }
                } else if ((typeof data[key] === 'string' || data[key] === null) &&
                    getIndex(key, e.parent.toolbarSettings.items) > -1) {
                    const value: string = ((data[key]) ? data[key] : '') as string;
                    let result: string = '';
                    switch (key) {
                    case 'formats': {
                        if (isNOU(dropDown.formatDropDown) || isPopToolbar ||
                                (!isNOU(dropDown.formatDropDown) && dropDown.formatDropDown.isDestroyed)) {
                            break;
                        }
                        const formatItems: IDropDownItemModel[] = e.parent.format.types;
                        const formatContent: string = isNOU(e.parent.format.default) ? formatItems[0].text :
                            e.parent.format.default;
                        result = getDropDownValue(formatItems, value, 'subCommand', 'text');
                        dropDown.formatDropDown.content = ('<span style="display: inline-flex;' +
                                'width:' + e.parent.format.width + '" >' +
                                '<span class="e-rte-dropdown-btn-text">'
                                + (isNOU(result) ? formatContent : result) +
                                '</span></span>');
                        dropDown.formatDropDown.dataBind();
                        break; }
                    case 'alignments': {
                        if (isNOU(dropDown.alignDropDown) ||
                                (!isNOU(dropDown.alignDropDown) && dropDown.alignDropDown.isDestroyed)) {
                            break;
                        }
                        const alignItems: IDropDownItemModel[] = model.alignmentItems;
                        result = getDropDownValue(alignItems, value, 'subCommand', 'iconCss');
                        dropDown.alignDropDown.iconCss = isNOU(result) ? 'e-icons e-justify-left' : result;
                        dropDown.alignDropDown.dataBind();
                        break; }
                    case 'fontname': {
                        if (isNOU(dropDown.fontNameDropDown) || isPopToolbar ||
                            (!isNOU(dropDown.fontNameDropDown) && dropDown.fontNameDropDown.isDestroyed)) {
                            break;
                        }
                        const fontNameItems: IDropDownItemModel[] = e.parent.fontFamily.items;
                        result = getDropDownValue(fontNameItems, value, 'value', 'text');
                        const fontNameContent: string = isNOU(e.parent.fontFamily.default) ? fontNameItems[0].text :
                            e.parent.fontFamily.default;
                        const name: string = (isNOU(result) ? fontNameContent : result);
                        e.tbElements[j].title = name;
                        dropDown.fontNameDropDown.content = ('<span style="display: inline-flex;' +
                            'width:' + e.parent.fontFamily.width + '" >' +
                            '<span class="e-rte-dropdown-btn-text">'
                            + name + '</span></span>');
                        dropDown.fontNameDropDown.dataBind();
                        break; }
                    case 'fontsize': {
                        if (isNOU(dropDown.fontSizeDropDown) ||
                            (!isNOU(dropDown.fontSizeDropDown) && dropDown.fontSizeDropDown.isDestroyed)) {
                            break;
                        }
                        const fontSizeItems: IDropDownItemModel[] = e.parent.fontSize.items;
                        const fontSizeContent: string = isNOU(e.parent.fontSize.default) ? fontSizeItems[1].text :
                            e.parent.fontSize.default;
                        result = getDropDownValue(
                            fontSizeItems, (value === '' ? fontSizeContent.replace(/\s/g, '') : value), 'value', 'text');
                        dropDown.fontSizeDropDown.content = ('<span style="display: inline-flex;' +
                            'width:' + e.parent.fontSize.width + '" >' +
                            '<span class="e-rte-dropdown-btn-text">'
                            + getFormattedFontSize(result) + '</span></span>');
                        dropDown.fontSizeDropDown.dataBind();
                        break; }
                    }
                }
            }
        }
    }
}

/**
 * @param {string} items - specifies the string value
 * @returns {string[]} - returns the array value
 * @hidden
 */
export function getCollection(items: string | string[]): string[] {
    if (typeof items === 'object') {
        return items;
    } else {
        return [items];
    }
}

/**
 * @param {string[]} items - specifies the array of string value
 * @param {IToolbarItemModel} toolbarItems - specifies the tool bar model
 * @returns {number} - returns the number
 * @hidden
 */
export function getTBarItemsIndex(items: string[], toolbarItems: IToolbarItemModel[]): number[] {
    const itemsIndex: number[] = [];
    for (let i: number = 0; i < items.length; i++) {
        for (let j: number = 0; j < toolbarItems.length; j++) {
            if (toolbarItems[j].type === 'Separator') {
                continue;
            } else {
                if (items[i] === 'OrderedList' && toolbarItems[j].subCommand === 'OL') {
                    itemsIndex.push(j);
                    break;
                } else if (items[i] === 'UnorderedList' && toolbarItems[j].subCommand === 'UL') {
                    itemsIndex.push(j);
                    break;
                } else if (items[i] === 'InsertCode' && toolbarItems[j].subCommand === 'Pre') {
                    itemsIndex.push(j);
                    break;
                } else if (items[i] === 'FileManager' && toolbarItems[j].subCommand === 'File') {
                    itemsIndex.push(j);
                    break;
                } else if (items[i] === toolbarItems[j].subCommand ||
                    typeof(items[i]) === 'object' && toolbarItems[j].command === 'Custom') {
                    itemsIndex.push(j);
                    break;
                }
            }
        }
    }
    return itemsIndex;
}

/**
 * @param {BaseToolbar} baseToolbar - specifies the base
 * @param {boolean} undoRedoStatus - specifies the boolean value
 * @returns {void}
 * @hidden
 */
export function updateUndoRedoStatus(baseToolbar: BaseToolbar, undoRedoStatus: { [key: string]: boolean }): void {
    let i: number = 0;
    const trgItems: number[] = getTBarItemsIndex(getCollection(undoRedoItems), baseToolbar.toolbarObj.items);
    const tbItems: HTMLElement[] = selectAll('.' + classes.CLS_TB_ITEM, baseToolbar.toolbarObj.element);
    const  keys: string[] = Object.keys(undoRedoStatus);
    for (const key of keys) {
        const target: HTMLElement = tbItems[trgItems[i]];
        if (target) {
            baseToolbar.toolbarObj.enableItems(target, undoRedoStatus[key]);
        }
        i++;
    }
}

/**
 * To dispatch the event manually
 *
 * @param {Element} element - specifies the element.
 * @param {string} type - specifies the string type.
 * @returns {void}
 * @hidden
 * @deprecated
 */
export function dispatchEvent(element: Element | HTMLDocument, type: string): void {
    const evt: Event = document.createEvent('HTMLEvents');
    evt.initEvent(type, false, true);
    element.dispatchEvent(evt);
}
/**
 * To parse the HTML
 *
 * @param {string} value - specifies the string value
 * @returns {DocumentFragment} - returns the document
 * @hidden
 */
export function parseHtml(value: string): DocumentFragment {
    const tempNode: HTMLTemplateElement = <HTMLTemplateElement>createElement('template');
    tempNode.innerHTML = value;
    if (tempNode.content instanceof DocumentFragment) {
        return tempNode.content;
    } else {
        return document.createRange().createContextualFragment(value);
    }
}
/**
 * @param {Document} docElement - specifies the document element
 * @param {Element} node - specifies the node
 * @returns {Node[]} - returns the node array
 * @hidden
 */
export function getTextNodesUnder(docElement: Document, node: Element): Node[] {
    let nodes: Node[] = [];
    for (node = node.firstChild as Element; node; node = node.nextSibling as Element) {
        if (node.nodeType === 3) {
            nodes.push(node);
        } else {
            nodes = nodes.concat(getTextNodesUnder(docElement, node));
        }
    }
    return nodes;
}
/**
 * @param {IToolsItemConfigs} obj - specifies the configuration
 * @returns {void}
 * @hidden
 */
export function toObjectLowerCase(obj: { [key: string]: IToolsItemConfigs }): { [key: string]: IToolsItemConfigs } {
    const convertedValue: { [key: string]: IToolsItemConfigs } = {};
    const keys: string[] = Object.keys(obj);
    for (let i: number = 0; i < Object.keys(obj).length; i++) {
        convertedValue[keys[i].toLocaleLowerCase()] = obj[keys[i]];
    }
    return convertedValue;
}
/**
 * @param {string} value - specifies the string value
 * @param {IRichTextEditor} rteObj - specifies the rte object
 * @returns {string} - returns the string
 * @hidden
 */
export function getEditValue(value: string, rteObj: IRichTextEditor): string {
    let val: string;
    if (value !== null && value !== '') {
        val = rteObj.enableHtmlEncode ? updateTextNode(decode(value)) : updateTextNode(value);
        rteObj.setProperties({ value: val }, true);
    } else {
        val = rteObj.enableHtmlEncode ? '&lt;p&gt;&lt;br/&gt;&lt;/p&gt;' : '<p><br/></p>';
    }
    return val;
}
/**
 * @param {string} value - specifies the value
 * @returns {string} - returns the string
 * @hidden
 */
export function updateTextNode(value: string): string {
    const tempNode: HTMLElement = document.createElement('div');
    const resultElm: HTMLElement = document.createElement('div');
    const childNodes: NodeListOf<Node> = tempNode.childNodes as NodeListOf<Node>;
    tempNode.innerHTML = value;
    tempNode.setAttribute('class', 'tempDiv');
    if (childNodes.length > 0) {
        let isPreviousInlineElem: boolean;
        let previousParent: HTMLElement;
        let paraElm: HTMLElement;
        while (tempNode.firstChild) {
            if ((tempNode.firstChild.nodeName === '#text' &&
            (tempNode.firstChild.textContent.indexOf('\n') < 0 || tempNode.firstChild.textContent.trim() !== '')) ||
            inlineNode.indexOf(tempNode.firstChild.nodeName.toLocaleLowerCase()) >= 0 ) {
                if (!isPreviousInlineElem) {
                    paraElm = createElement('p');
                    resultElm.appendChild(paraElm);
                    paraElm.appendChild(tempNode.firstChild);
                } else {
                    previousParent.appendChild(tempNode.firstChild);
                }
                previousParent = paraElm;
                isPreviousInlineElem = true;
            } else if (tempNode.firstChild.nodeName === '#text' && (tempNode.firstChild.textContent === '\n' ||
            (tempNode.firstChild.textContent.indexOf('\n') >= 0 && tempNode.firstChild.textContent.trim() === ''))) {
                detach(tempNode.firstChild);
            } else {
                resultElm.appendChild(tempNode.firstChild);
                isPreviousInlineElem = false;
            }
        }
        const imageElm: NodeListOf<HTMLElement> = resultElm.querySelectorAll('img');
        for (let i: number = 0; i < imageElm.length; i++) {
            if (!imageElm[i].classList.contains(classes.CLS_RTE_IMAGE)) {
                imageElm[i].classList.add(classes.CLS_RTE_IMAGE);
            }
            if (!(imageElm[i].classList.contains(classes.CLS_IMGINLINE) ||
            imageElm[i].classList.contains(classes.CLS_IMGBREAK))) {
                imageElm[i].classList.add(classes.CLS_IMGINLINE);
            }
        }
    }
    return resultElm.innerHTML;
}

/**
 * @param {string} value - specifies the value
 * @returns {boolean} - returns the boolean value
 * @hidden
 */
export function isEditableValueEmpty(value: string): boolean {
    return (value === '<p><br></p>' || value === '&lt;p&gt;&lt;br&gt;&lt;/p&gt;' || value === '') ? true : false;
}

/**
 * @param {string} value - specifies the string value
 * @returns {string} - returns the string
 * @hidden
 */
export function decode(value: string): string {
    return value.replace(/&amp;/g, '&').replace(/&amp;lt;/g, '<')
        .replace(/&lt;/g, '<').replace(/&amp;gt;/g, '>')
        .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/&amp;nbsp;/g, ' ').replace(/&quot;/g, '');
}

/**
 * @param {string} value - specifies the string value
 * @param {IRichTextEditor} parent - specifies the rte
 * @returns {string} - returns the string value
 * @hidden
 */
export function sanitizeHelper(value: string, parent?: IRichTextEditor): string {
    if (parent.enableHtmlSanitizer) {
        const item: BeforeSanitizeHtmlArgs = SanitizeHtmlHelper.beforeSanitize();
        const beforeEvent: BeforeSanitizeHtmlArgs = {
            cancel: false,
            helper: null
        };
        extend(item, item, beforeEvent);
        parent.trigger('beforeSanitizeHtml', item);
        if (item.cancel && !isNOU(item.helper)) {
            value = item.helper(value);
        } else if (!item.cancel) {
            value = SanitizeHtmlHelper.serializeValue(item, value);
        }
    }
    return value;
}
/**
 * @param {string} dataUrl - specifies the string value
 * @returns {BaseToolbar} - returns the value
 * @hidden
 */
//Converting the base64 url to blob
export function convertToBlob(dataUrl: string): Blob {
    const arr: string[] = dataUrl.split(',');
    const mime: string = arr[0].match(/:(.*?);/)[1];
    const bstr: string = atob(arr[1]);
    let n: number = bstr.length;
    const u8arr: Uint8Array = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * @param {IRichTextEditor} self - specifies the rte
 * @param {string} localeItems - specifies the locale items
 * @param {IDropDownItemModel} item - specifies the dropdown item
 * @returns {string} - returns the value
 * @hidden
 */
export function getLocaleFontFormat(self: IRichTextEditor, localeItems: { [ket: string]: string }[], item: IDropDownItemModel): string {
    for(let i: number = 0; localeItems.length > i; i++) {
        if(localeItems[i].value === item.value || localeItems[i].value === item.subCommand) {
            return self.localeObj.getConstant(localeItems[i].locale);
        }
    }
    return item.text;
}

/**
 * @param {IRichTextEditor} self - specifies the rte
 * @returns {void}
 * @hidden
 */
export function updateDropDownFontFormatLocale(self: IRichTextEditor): void {
    model.fontFamily.forEach((item: IDropDownItemModel, i: number) => {
        model.fontFamily[i].text = getLocaleFontFormat(self, fontNameLocale, model.fontFamily[i]);
    });
    model.formatItems.forEach((item: IDropDownItemModel, i: number) => {
        model.formatItems[i].text = getLocaleFontFormat(self, formatsLocale, model.formatItems[i]);
    });
}