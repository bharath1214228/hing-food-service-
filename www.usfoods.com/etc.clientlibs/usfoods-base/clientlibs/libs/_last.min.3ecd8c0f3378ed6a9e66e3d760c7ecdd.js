/* ==========================================================================
     US Foods Vue Configuration
   ========================================================================== */
/**
 * Instantiates a global vue instance for non parent-child event communication,
 * must come last in the call stack to work. That's why this directory is separate
 * from /libs/main/source/
 *
 * @see https://vuejs.org/v2/guide/components.html#Non-Parent-Child-Communication
 */

Vue.config.ignoredElements = [
    'cq'
]

var isEventTeaserRegistered = false;
var initVueTriggered = false;
var initVueDelayTriggered = false;

var store = {
    debug: true,
    state: {
        authenticated: false,
        customerCookieData: {},
        customerAccountData: {
            coreProfile: {
                // Default to false for accepting orders.
                acceptOrderFlag: 'N'
            }
        }
    }
}

if (typeof USFoods !== 'undefined') {
    USFoods.vueEvents = new Vue();
}

function sharethis(){
    if ( $('.sharethis-inline-share-buttons').length > 0 ) {
        var s = document.createElement('script');
        s.setAttribute('src', "//platform-api.sharethis.com/js/sharethis.js#property=59b97082e6ce520012a00027&product=inline-share-buttons");
        document.head.appendChild(s);
    }
}

function initVue() {
    if (typeof USFoods !== 'undefined') {
        initVueTriggered = true;

        USFoods.vue = new Vue({
            el: '.body-frame',
            data: {
                USFState: store.state
            },
            mounted: function(){
                $(document).trigger("dce-vue-instance-ready");
            }
        });
        // Initialize shareThis when context hub is present.
        sharethis();

        // Dispatch event to reload overlays - works when page is included in iframe
        var event = document.createEvent("Event");
        event.initEvent("reload-overlays", false, true);
        // args: string type, boolean bubbles, boolean cancelable
        window.dispatchEvent(event);
    }
};

/**
 * This method (teasersLoadedInitVue) is registered for simple oganization, and is fired when ContextHub is present.
 */
function teasersLoadedInitVue(){

    if (typeof ContextHub !== 'undefined' && typeof USFoods !== 'undefined') {
        /**
         * ContextHub Targeting replaces content in the page as the page is loading, breaking Vue components if they had already
         * loaded. The eventing methods below check to see if EVENT_TEASER_REGISTERED is triggered, if so then there is ContextHub
         * Targeting happening and we need to wait until EVENT_TEASER_LOADED fires. Otherwise, initialize Vue on
         * EVENT_STORES_PARTIALLY_READY instead.
         */
        ContextHub.eventing.on(ContextHub.Constants.EVENT_TEASER_REGISTERED, function () {
            isEventTeaserRegistered = true;
        });

        ContextHub.eventing.on(ContextHub.Constants.EVENT_ALL_STORES_READY, function () {
            if (!isEventTeaserRegistered && !initVueTriggered) {
                initVue();
            }
        });

        ContextHub.eventing.on(ContextHub.Constants.EVENT_STORES_PARTIALLY_READY, function () {
            if (!isEventTeaserRegistered && !initVueTriggered) {
                initVue();
            }
        });

        /**
         * This function will function as a safety net in the event that the ContextHub failed to properly process things.
         * It will wait for 5 seconds after page load, and if VueJS has not been initialized at that point, it will
         * initialize it.
         */
        ContextHub.eventing.on(ContextHub.Constants.EVENT_TEASER_LOADED, function () {
            if (!initVueDelayTriggered) {
                initVueDelayTriggered = true;
                setTimeout(function() {
                    if (!initVueTriggered) {
                        initVue();
                    }
                }, 5000);
            }
        });

        ContextHub.eventing.on(ContextHub.Constants.EVENT_TEASER_COMPLETED, function () {
            if (!initVueTriggered) {
                initVue();
            }
        });

        /* Listen for a custom targeting event that will then reinitialize Vue components and trigger a reload
        * of the overlays. The multiple delays are necessary so things elsewhere on the page can get into place
        * before we refresh Vue and reload overlays.
        */
        ContextHub.eventing.on('usf-targeted-overlay-refresh', function () {
            setTimeout(function () {
                USFoods.vue = new Vue({
                    el: '.body-frame',
                    data: {
                        USFState: store.state
                    },
                    mounted: function(){
                        $(document).trigger("dce-vue-instance-ready");
                    }
                });
            }, 500);

            setTimeout(function () {
                var event = document.createEvent("Event");
                event.initEvent("reload-overlays-in-targeting", false, true);
                // args: string type, boolean bubbles, boolean cancelable
                window.dispatchEvent(event);
            }, 1000);
        });
    }
};

/**
 * Instantiates the primary vue instance for all AEM component Vue components
 */
if (typeof USFoods !== 'undefined') {
    USFoods.Utils.browserDetection();

    if (typeof ContextHub !== 'undefined') {
        /**
         * This is where Vue will be initialized.
         * ContextHub eventing will be inplace, and Vue will initialize vie ContextHub, when teasers are present.
         * As a fallback, a timeout is set to verify that teasers are accounted for.
         * In the event there are no teasers on the page,
         * personalization does not exist and Vue is initialized, regardless of ContextHub eventing in place.
         */
        teasersLoadedInitVue();

        setTimeout( function(){
            var totalTeasers = ContextHub.SegmentEngine.PageInteraction.TeaserManager.getAllTeasers();
            if (_.isEmpty(totalTeasers) && !initVueTriggered) {
                initVue();
            }
        }, 1000);
    } else {
        // When there is no ContextHub, just initialize vue
        USFoods.vue = new Vue({
            el: '.body-frame',
            data: {
                USFState: store.state
            },
            mounted: function(){
                $(document).trigger("dce-vue-instance-ready");
            }
        });
        // Initialize shareThis when no context hub is present.
        sharethis();
    }
    setTimeout(() => {
        $(".page-template-home-page .page-footer").removeClass('init');
    },5000);

}

/**
 * Method used to recreate the overlays for components in the editor.
 */
var recreateOverlays = function() {
    if (typeof Granite.author !== 'undefined' && Granite.author.layerManager.getCurrentLayerName() !== 'Preview') {
        Granite.author.ContentFrame.loadEditables();
        // Iterate over editables and recreate the overlays for all components
        for (var editable in Granite.author.editables) {
            if (Granite.author.editables[editable].path !== undefined) {
                Granite.author.editables[editable].dom = Granite.author.ContentFrame.getEditableNode(Granite.author.editables[editable].path);
                Granite.author.overlayManager.recreate(Granite.author.editables[editable]);
            }
        }
        // If the mode is not targeting, trigger an event to reload the target component overlays
        if (Granite.author.layerManager.getCurrentLayerName() !== 'Targeting'
            && Granite?.author?.EditorFrame.editableToolbar) {
            $(document).trigger($.Event('cq-layer-activated', {
                layer: "Edit",
                prevLayer: ""
            }));
        }
    }
};

// Check for jQuery - if it is there we can assume it is Edit mode
if (typeof jQuery !== 'undefined') {
    // Recreate overlays when the editor is done loading
    $(document).on('cq-editor-loaded', function() {
        if (Granite.author.layerManager.getCurrentLayerName() !== 'Targeting') {
            recreateOverlays();
        }
    });
    // Recreate overlays when the iframe contents trigger the event
    $(document).on('cq-content-frame-loaded', function() {
        $('#ContentFrame')[0].contentWindow.addEventListener('reload-overlays', function() {
            if (Granite.author.layerManager.getCurrentLayerName() !== 'Targeting') {
                recreateOverlays();
            }
        });
        $('#ContentFrame')[0].contentWindow.addEventListener('reload-overlays-in-targeting', function() {
            if (Granite.author.layerManager.getCurrentLayerName() === 'Targeting') {
                recreateOverlays();
            }
        });
    });
}

/**
 * Load Vue Cookie plugin
 */
Vue.use(window.$cookies);
/**
 * Load Vue Form Validation Plugin
 */
Vue.use(VeeValidate);

/**
 * In order to use the minified version of Vue but also have access to warnings and devtools in Author, need to check
 * set devtools to true (in appropriate environments)
 */
if (document.getElementsByTagName("body")[0].getAttribute("data-vue-dev-mode") == "true") {
    Vue.config.devtools = true;
}