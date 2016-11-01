
import {
    cloneNodes, virtualElements, cleanNode
} from 'tko.utils';

import {
    unwrap, dependencyDetection
} from 'tko.observable';

import {
    computed
} from 'tko.computed';

import {
    applyBindingsToDescendants
} from 'tko.bind';

/**
 * Test a node for whether it represents an "else" condition.
 * @param  {HTMLElement}  node to be tested
 * @return {Boolean}      true when
 *
 * Matches <!-- else -->
 */
function isElseNode(node) {
    return node.nodeType === 8 &&
        node.nodeValue.trim().toLowerCase() === 'else';
}

function detectElse(element) {
    var children = virtualElements.childNodes(element);
    for (var i = 0, j = children.length; i < j; ++i) {
        if (isElseNode(children[i])) { return true; }
    }
    return false;
}


/**
 * Clone the nodes, returning `ifNodes`, `elseNodes`
 * @param  {HTMLElement} element The nodes to be cloned
 * @param  {boolean}    hasElse short-circuit to speed up the inner-loop.
 * @return {object}         Containing the cloned nodes.
 */
function cloneIfElseNodes(element, hasElse) {
    var children = virtualElements.childNodes(element),
        ifNodes = [],
        elseNodes = [],
        target = ifNodes;
      
    for (var i = 0, j = children.length; i < j; ++i) {
        if (hasElse && isElseNode(children[i])) {
            target = elseNodes;
            hasElse = false;
        } else {
            target.push(cleanNode(children[i].cloneNode(true)));
        }
    }
    
    return {
        ifNodes: ifNodes,
        elseNodes: elseNodes
    };
}


/**
 * Create a DOMbinding that controls DOM nodes presence
 *
 * Covers e.g.
 *
 * 1. DOM Nodes contents
 * 
 * <div data-bind='if: x'>
 * <!-- else --> ... an optional "if"
 * </div>
 * 
 * 2. Virtual elements
 * 
 * <!-- ko if: x -->
 * <!-- else -->
 * <!-- /ko -->
 *
 * 3. Else binding
 * <div data-bind='if: x'></div>
 * <div data-bind='else'></div>
 */
function makeWithIfBinding(isWith, isNot, isElse, makeContextCallback) {
    return {
        init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    
            var didDisplayOnLastUpdate,
                hasElse = detectElse(element),
                ifElseNodes;
    
            computed(function() {
                var rawValue = valueAccessor(),
                    dataValue = unwrap(rawValue),
                    shouldDisplayIf = !isNot !== !dataValue, // equivalent to isNot ? !dataValue : !!dataValue
                    isFirstRender = !ifElseNodes,
                    needsRefresh = isFirstRender || isWith || (shouldDisplayIf !== didDisplayOnLastUpdate);
                
                if (!needsRefresh) { return; }
                
                if (isFirstRender && (dependencyDetection.getDependenciesCount() || hasElse)) {
                    ifElseNodes = cloneIfElseNodes(element, hasElse);
                }

                if (shouldDisplayIf) {
                    if (!isFirstRender || hasElse) {
                        virtualElements.setDomNodeChildren(element, cloneNodes(ifElseNodes.ifNodes));
                    }
                } else if (ifElseNodes) {
                    virtualElements.setDomNodeChildren(element, cloneNodes(ifElseNodes.elseNodes));
                } else {
                    virtualElements.emptyNode(element);
                }

                applyBindingsToDescendants(makeContextCallback ? makeContextCallback(bindingContext, rawValue) : bindingContext, element);

                didDisplayOnLastUpdate = shouldDisplayIf;
            }, null, { disposeWhenNodeIsRemoved: element });
    
            return { 'controlsDescendantBindings': true };
        },
        allowVirtualElements: true,
        bindingRewriteValidator: false
    };
}

function withContextCallback(bindingContext, dataValue) {
    return bindingContext.createStaticChildContext(dataValue);
}

                                 /* isWith, isNot */
export var $if =   makeWithIfBinding(false, false, false);
export var ifnot = makeWithIfBinding(false, true, false);
export var $else = makeWithIfBinding(false, false, true);
export var $with = makeWithIfBinding(true, false, false, withContextCallback);
