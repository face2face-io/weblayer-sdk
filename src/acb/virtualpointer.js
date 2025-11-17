/**
 * VirtualPointer - Mouse and touch event simulation with visual feedback
 * Integrated into WebLayer SDK for ACB functionality
 * Based on JS-Virtual-Pointer/virtualpointer.js
 */

var virtualpointer = function() { 
    "use strict";

    // some default values for running events
    var mouse_position          = {x: 1, y: 1},
        event_queue             = [],
        default_interval        = 20,
        first_event_offset      = 50,
        default_flick_duration  = 200,
        default_click_duration  = Math.random() * (250 - 20) + 20,
        default_screen_x_offset = 1,
        default_screen_y_offset = 30,
        show_visual_cursor      = true,
        cursor_element          = null,
        ripple_element          = null;

    // initialize visual cursor
    function init_visual_cursor() {
        if (cursor_element) return; // already initialized

        // create cursor container with label
        var cursor_container = document.createElement('div');
        cursor_container.id = 'virtualpointer-container';
        cursor_container.style.cssText = 
            'position: fixed;' +
            'pointer-events: none;' +
            'z-index: 999999;' +
            'display: flex;' +
            'align-items: flex-start;' +
            'gap: 8px;';

        // create SVG cursor element (triangular Figma-style pointer)
        var cursor_svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        cursor_svg.setAttribute('width', '24');
        cursor_svg.setAttribute('height', '24');
        cursor_svg.setAttribute('viewBox', '0 0 24 24');
        cursor_svg.style.cssText = 
            'filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));' +
            'transition: all 0.1s ease-out;';

        // create the triangular cursor path
        var cursor_path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        cursor_path.setAttribute('d', 'M5.5 3L20.5 18L12 15.5L9.5 22L5.5 3Z');
        cursor_path.setAttribute('fill', '#3b82f6');
        cursor_path.setAttribute('stroke', 'white');
        cursor_path.setAttribute('stroke-width', '1.5');
        cursor_path.setAttribute('stroke-linejoin', 'round');
        
        cursor_svg.appendChild(cursor_path);

        // create label element
        var label_element = document.createElement('div');
        label_element.id = 'virtualpointer-label';
        label_element.textContent = 'AI';
        label_element.style.cssText = 
            'background: #3b82f6;' +
            'color: white;' +
            'padding: 4px 10px;' +
            'border-radius: 12px;' +
            'font-size: 12px;' +
            'font-weight: 600;' +
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
            'white-space: nowrap;' +
            'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);' +
            'letter-spacing: 0.3px;' +
            'margin-top: 2px;';

        // create ripple element for clicks (blue)
        ripple_element = document.createElement('div');
        ripple_element.id = 'virtualpointer-ripple';
        ripple_element.style.cssText = 
            'position: fixed;' +
            'width: 10px;' +
            'height: 10px;' +
            'border-radius: 50%;' +
            'background: rgba(59, 130, 246, 0.4);' +
            'border: 2px solid rgba(59, 130, 246, 0.6);' +
            'pointer-events: none;' +
            'z-index: 999998;' +
            'transform: translate(-50%, -50%) scale(0);' +
            'opacity: 0;';

        // assemble cursor with label
        cursor_container.appendChild(cursor_svg);
        cursor_container.appendChild(label_element);
        
        document.body.appendChild(cursor_container);
        document.body.appendChild(ripple_element);
        
        // update reference to container for positioning
        cursor_element = cursor_container;
    }

    // update visual cursor position
    function update_visual_cursor(clientX, clientY, element) {
        if (!show_visual_cursor || !cursor_element) return;

        // if element is provided, use its precise viewport position
        if (element) {
            var rect = element.getBoundingClientRect();
            // Position cursor pointer at center of element
            var centerX = rect.left + (rect.width / 2);
            var centerY = rect.top + (rect.height / 2);
            cursor_element.style.left = centerX + 'px';
            cursor_element.style.top = centerY + 'px';
        } else {
            // fallback: convert document coordinates to viewport coordinates
            var viewportX = clientX - (window.pageXOffset || document.documentElement.scrollLeft);
            var viewportY = clientY - (window.pageYOffset || document.documentElement.scrollTop);
            cursor_element.style.left = viewportX + 'px';
            cursor_element.style.top = viewportY + 'px';
        }
    }

    // show click ripple effect
    function show_click_ripple(clientX, clientY, element) {
        if (!show_visual_cursor || !ripple_element) return;

        // if element is provided, use its precise viewport position
        if (element) {
            var rect = element.getBoundingClientRect();
            var centerX = rect.left + (rect.width / 2);
            var centerY = rect.top + (rect.height / 2);
            ripple_element.style.left = centerX + 'px';
            ripple_element.style.top = centerY + 'px';
        } else {
            // fallback: convert document coordinates to viewport coordinates
            var viewportX = clientX - (window.pageXOffset || document.documentElement.scrollLeft);
            var viewportY = clientY - (window.pageYOffset || document.documentElement.scrollTop);
            ripple_element.style.left = viewportX + 'px';
            ripple_element.style.top = viewportY + 'px';
        }

        ripple_element.style.transition = 'none';
        ripple_element.style.transform = 'translate(-50%, -50%) scale(0)';
        ripple_element.style.opacity = '1';

        // trigger reflow to restart animation
        ripple_element.offsetHeight;

        ripple_element.style.transition = 'all 0.4s ease-out';
        ripple_element.style.transform = 'translate(-50%, -50%) scale(4)';
        ripple_element.style.opacity = '0';
    }

    // remove visual cursor
    function remove_visual_cursor() {
        // Remove container (which includes cursor and label)
        if (cursor_element && cursor_element.parentNode) {
            cursor_element.parentNode.removeChild(cursor_element);
            cursor_element = null;
        }
        // Remove ripple element
        if (ripple_element && ripple_element.parentNode) {
            ripple_element.parentNode.removeChild(ripple_element);
            ripple_element = null;
        }
    }

    // function to dispatch event inside the browser
    function send_event(type, clientX, clientY, element, button, screenX, screenY, isTouchEvent, scrollLeft, scrollTop) {
        if (type == 'scroll') {
            window.scrollTo(scrollLeft, scrollTop);
            return;
        }

        // calculate screenX and screenY if not provided
        if (!screenX) { 
            screenX = clientX + default_screen_x_offset; 
        }
        if (!screenY) {
            screenY = clientY + default_screen_y_offset;
        }

        // update visual cursor position (use element for precise positioning)
        update_visual_cursor(clientX, clientY, element);

        // show ripple on click events (use element for precise positioning)
        if (type === 'click' || type === 'mousedown' || type === 'touchstart') {
            show_click_ripple(clientX, clientY, element);
        }

        // if button is not specified, assume the button is the left mouse button
        if (!button && ( type === 'click' || type === 'mousedown' || type === 'mouseup') ) {
            button = 0; // left button is default
        }

        // detail is the value for # of times this element has been clicked, set it to 1 when doing click events
        var detail = (type !== 'mousemove' && type !== 'touchmove') ? 1 : 0;

        // construct new event object, either touch or mouse event
        if (isTouchEvent && 
             ( ('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) ) 
           ) {

            var eventObject = document.createEvent("TouchEvent");
            eventObject.initTouchEvent(type,  true, true, window, detail, screenX, screenY, clientX, clientY, false, false, false, false, button, null);
        } else {
            var eventObject = document.createEvent("MouseEvent");
            eventObject.initMouseEvent(type,  true, true, window, detail, screenX, screenY, clientX, clientY, false, false, false, false, button, null);   
        }
        // if element specified, fire event on the element object
        if (element) {
            element.dispatchEvent(eventObject);
        // otherwise fire event on document.body
        } else {
            document.body.dispatchEvent(eventObject);
        }

        mouse_position = {x: screenX, y: screenY};
    }

    // processes event stack
    function process_event_queue() {
        if (event_queue.length) {
            var current_event = event_queue[0],
                next_event    = event_queue[1];

            send_event(current_event.type, current_event.pageX, current_event.pageY, current_event.target, null, current_event.screenX, current_event.screenY, current_event.isTouchEvent, current_event.scrollLeft, current_event.scrollTop);

            if (next_event) {
                var offset = next_event.timestamp - current_event.timestamp;
                setTimeout(process_event_queue, offset);
            }
            event_queue.shift();
        }
    }

    function get_offset_of_element(element) {
        // calculate position of element
        var body_rect = document.body.getBoundingClientRect(),
            elem_rect = element.getBoundingClientRect(),
            y_offset  = elem_rect.top - body_rect.top,
            x_offset  = elem_rect.left - body_rect.left;

        // return values
        return {x: x_offset, y: y_offset};
    }

    // check if element is in viewport
    function is_element_in_viewport(element) {
        var rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // smoothly scroll element into view
    function scroll_to_element(element, callback) {
        if (is_element_in_viewport(element)) {
            // element already visible, execute callback immediately
            if (callback) callback();
            return;
        }

        // scroll element into view with smooth behavior
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
        });

        // wait for scroll to complete before executing callback
        // detect when scrolling stops
        var scrollTimeout;
        var lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var lastScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        var checkScrollComplete = function() {
            var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var currentScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            if (currentScrollTop === lastScrollTop && currentScrollLeft === lastScrollLeft) {
                // scrolling has stopped
                if (callback) callback();
            } else {
                // still scrolling, check again
                lastScrollTop = currentScrollTop;
                lastScrollLeft = currentScrollLeft;
                scrollTimeout = setTimeout(checkScrollComplete, 50);
            }
        };

        scrollTimeout = setTimeout(checkScrollComplete, 100);
    }

    // constructs mouse movement stack to move mouse to an element over a set amount of time
    function build_mouse_movement_queue(element, duration) {
        // calculate position of element
        var element_offset = get_offset_of_element(element);

        // calculate distance
        var x_distance = element_offset.x - mouse_position.x,
            y_distance = element_offset.y - mouse_position.y;

        // determine number of increments
        var increments = duration / default_interval; // divide number of milliseconds for duration by 20, since we want to send events every 20ish milliseconds
        for (var i = 1; i <= increments; i++) {
            var new_x_pos = Math.round(x_distance / increments * i) + mouse_position.x,
                new_y_pos = Math.round(y_distance / increments * i) + mouse_position.y;

            event_queue.push({
                                type:           "mousemove",
                                pageX:          new_x_pos, 
                                pageY:          new_y_pos, 
                                screenX:        new_x_pos + default_screen_x_offset, 
                                screenY:        new_y_pos + default_screen_y_offset,  
                                timestamp:      i * default_interval
                            });
        }
        
    }

    // construct click event stack to click on an element
    function build_click_event_queue(element, duration, is_mobile) {
        // calculate position of element
        var element_offset = get_offset_of_element(element);

        // get timestamp of last event in queue
        var last_timestamp = (event_queue.length) ? event_queue[event_queue.length - 1].timestamp : 0;

        if (!duration) {
            duration = default_click_duration;
        }

        // mobile events are different (touchstart)
        var screen_x, screen_y;
        if (is_mobile) {
            screen_x = element_offset.x;
            screen_y = element_offset.y;

            event_queue.push({
                                type:           "touchstart", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y, 
                                timestamp:      last_timestamp, 
                                target:         element, 
                                isTouchEvent: true
                            });

            event_queue.push({
                                type:           "touchmove", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y,
                                timestamp:      last_timestamp + Math.floor(default_click_duration / 2), 
                                target:         element, 
                                isTouchEvent: true
                            });

            event_queue.push({
                                type:           "touchend", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y,
                                timestamp:      last_timestamp + default_click_duration, 
                                target:         element, 
                                isTouchEvent: true
                            });
            

        } else {
            screen_x = element_offset.x + default_screen_x_offset;
            screen_y = element_offset.y + default_screen_y_offset;

            event_queue.push({
                                type:           "mouseover", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y,
                                timestamp:      last_timestamp + default_click_duration + 10, 
                                target:         element, 
                                isTouchEvent: false
                        });

            event_queue.push({
                                type:           "mousemove", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x, 
                                screenY:        screen_y, 
                                timestamp:      last_timestamp + default_click_duration + 20, 
                                target:         element, 
                                isTouchEvent: false
                        });
            
            event_queue.push({
                                type:           "mousedown", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x, 
                                screenY:        screen_y, 
                                timestamp:      last_timestamp + default_click_duration + 20, 
                                target:         element, 
                                isTouchEvent: false
                        });

            event_queue.push({
                                type:           "mouseup", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y, 
                                timestamp:      last_timestamp + (default_click_duration * 2), 
                                target:         element, 
                                isTouchEvent: false
                        });

            event_queue.push({
                                type:           "click", 
                                pageX:          element_offset.x, 
                                pageY:          element_offset.y, 
                                screenX:        screen_x,
                                screenY:        screen_y, 
                                timestamp:      last_timestamp + (default_click_duration * 2) + 10, 
                                target:         element, 
                                isTouchEvent: false
                        });
        }


    }

    // function to begin execution of events inside event_queue
    function start_processing_events() {
        // ensure visual cursor is initialized if show_visual_cursor is enabled
        if (show_visual_cursor) {
            init_visual_cursor();
        }
        setTimeout(process_event_queue, first_event_offset);
    }

    // exposed functions that can be called using virtualpointer.function_name();
    return {
        move_mouse_to_element: function(element, duration) {
            if (!element) return;
            
            scroll_to_element(element, function() {
                build_mouse_movement_queue(element, duration);
                start_processing_events();
            });
        },
        click_element: function(element) {
            if (!element) return;

            scroll_to_element(element, function() {
                build_click_event_queue(element);
                start_processing_events();
            });
        },
        move_to_element_and_click: function(element, duration) {
            if (!element) return;

            scroll_to_element(element, function() {
                build_mouse_movement_queue(element, duration);
                build_click_event_queue(element);
                start_processing_events();
            });
        },
        tap_element: function(element) {
            if (!element) return;

            scroll_to_element(element, function() {
                build_click_event_queue(element, null, true);
                start_processing_events();
            });
        },
        double_tap_element: function(element) {
            if (!element) return;

            scroll_to_element(element, function() {
                build_click_event_queue(element, null, true);
                build_click_event_queue(element, 25, true);
                start_processing_events();
            });
        },
        flick_to_element: function(element, duration) {
            if (!element) return;

            scroll_to_element(element, function() {
                // Simplified flick - just use click for now
                build_click_event_queue(element, duration, true);
                start_processing_events();
            });
        },
        // used for executing a serialized set of JSON events
        run_serialized_events: function(events) {
            if (!events || !(events instanceof Array)) return;

            event_queue = events;
            start_processing_events();
        },
        // enable visual cursor to see where events are happening
        show_cursor: function() {
            show_visual_cursor = true;
            init_visual_cursor();
        },
        // disable and remove visual cursor
        hide_cursor: function() {
            show_visual_cursor = false;
            remove_visual_cursor();
        }
    }
}();

// Export for use in SDK
export default virtualpointer;

