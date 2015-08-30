/* global angular:true $:true */

// Rules below here temporaly, and should be taken care of eventually
/* eslint no-use-before-define:0 curly:0 */

(function(global) {

    var DigestHud = global.DigestHud = function($provide) {
      var digestHud = this;

      digestHud.digestTimings = [];
      digestHud.watchTimings = {};
      digestHud.inDigest = false;
      digestHud.hudElement = false;
      digestHud.defaultHudPosition = 'bottom right';
      digestHud.customHudPosition = false;
      digestHud.$parse = false;
      digestHud.numTopWatches = 20;
      digestHud.numDigestStats = 25;
      digestHud.timingStack = [];
      digestHud.summaryElement = false;
      digestHud.original = {};
      digestHud.enabled = false;

      var WatchTiming = digestHud.WatchTiming = function(key) {
        this.key = key;
        this.reset();
      };

      WatchTiming.prototype.reset = function() {
        this.watch = 0;
        this.handle = 0;
        this.overhead = 0;
        this.total = 0;
        this.cycleTotal = 0;
        this.cycleStart = null;
        this.subTotal = 0;
      };

      WatchTiming.prototype.startCycle = function(start) {
        this.cycleStart = start;
        this.cycleTotal = 0;
        this.subTotal = 0;
      };

      WatchTiming.prototype.countTime = function(counter, duration) {
        this[counter] += duration - this.subTotal;
        this.cycleTotal += duration;
        this.subTotal = 0;
      };

      WatchTiming.prototype.endCycle = function() {
        if (!this.cycleStart) {
            return;
        }
        var duration = Date.now() - this.cycleStart;
        this.overhead += duration - this.cycleTotal;
        this.cycleStart = null;
        digestHud.timingStack.pop();
        if (digestHud.timingStack.length) {
          digestHud.timingStack[digestHud.timingStack.length - 1].subTotal += duration;
        } else {
          digestHud.overheadTiming.overhead -= duration;
        }
      };

      WatchTiming.prototype.sum = function() {
        this.total = this.watch + this.handle + this.overhead;
      };

      WatchTiming.prototype.format = function(grandTotal) {
        return digestHud.percentage(this.total / grandTotal) + '\u2003(' +
          digestHud.percentage(this.watch / grandTotal) + ' + ' +
          digestHud.percentage(this.handle / grandTotal) + ' + ' +
          digestHud.percentage(this.overhead / grandTotal) +
          ')\u2003' + this.key;
      };

      digestHud.flushTimingCycle = function() {
        if (digestHud.timingStack.length) {
            digestHud.timingStack[digestHud.timingStack.length - 1].endCycle();
        }
      };

      digestHud.resetTimings = function() {
        digestHud.digestTimings.length = 0;

        Object.keys(digestHud.watchTimings).map(function(k){
          return digestHud.watchTimings[k];
        }).forEach(function(watchTiming) {
          watchTiming.reset();
        });
      };

      digestHud.showHud = function() {
        var detailsText = '';

        digestHud.hudElement = $('<div></div>');
        var buttonsElement = $(
          '<div>' +
          '<span id="digestHud-refresh">refresh</span> &bull; ' +
          '<span id="digestHud-reset">reset</span> ' +
          '</div>').appendTo(digestHud.hudElement);
        digestHud.summaryElement = $('<div></div>').appendTo(digestHud.hudElement);
        var detailsElement = $('<div></div>').appendTo(digestHud.hudElement);
        var showDetails = false;
        digestHud.hudElement.on('click', function() {
          showDetails = !showDetails;
          buttonsElement.toggle(showDetails);
          detailsElement.toggle(showDetails);
          if (showDetails) {
              refreshDetails();
          }
        });

        digestHud.hudElement.on('copy', function(ev) {
          ev.originalEvent.clipboardData.setData('text/plain', detailsText);
          ev.preventDefault();
        });

        buttonsElement.find('#digestHud-refresh').on('click', refreshDetails);
        buttonsElement.find('#digestHud-reset').on('click', digestHud.resetTimings);
        buttonsElement.on('click', function(ev) {ev.stopPropagation();});

        digestHud.hudElement.on('mousedown mouseup click', function(ev) {ev.stopPropagation();});
        digestHud.hudElement.css({
          position: 'fixed',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          color: 'white',
          padding: '2px 5px',
          fontSize: 'small',
          cursor: 'default',
          zIndex: '1000000'
        });

        digestHud.setHudPosition(digestHud.customHudPosition || digestHud.defaultHudPosition);

        buttonsElement.css({
          float: 'right',
          display: 'none'
        });
        buttonsElement.children().css({
          cursor: 'pointer'
        });
        detailsElement.css({
          whiteSpace: 'pre',
          minWidth: '30em',
          maxWidth: '50em',
          display: 'none'
        });
        $('body').append(digestHud.hudElement);

        function refreshDetails() {
          var grandTotal = 0, topTotal = 0;

          var topWatchTimings = Object.keys(digestHud.watchTimings).map(function(k){
            return digestHud.watchTimings[k];
          }).map(function(timing) {
            timing.sum(); grandTotal += timing.total;
            return timing;
          }).sort(function(a, b) {
            var x = a.total; var y = b.total;
             return ((x < y) ? 1 : ((x > y) ? -1 : 0));
          }).slice(0, digestHud.numTopWatches);

          var lines = topWatchTimings.map(function(timing) {
            topTotal += timing.total;
            return timing.format(grandTotal);
          });
          var rows = lines.map(function(text) {
            var row = $('<div></div>');
            row.css({
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            });
            row.text(text.replace(/[ \n]+/g, ' '));
            row.attr('title', text.slice(29));
            return row;
          });
          detailsElement.empty();
          $('<div>\u2007Total\u2007\u2007\u2007Watch\u2007Work\u2007Overhead\u2007\u2007Function</div>')
            .css({borderBottom: '1px solid'}).appendTo(detailsElement);
          detailsElement.append(rows);
          var footer = 'Top ' + topWatchTimings.length + ' items account for ' +
            digestHud.percentage(topTotal / grandTotal) + ' of ' + grandTotal + 'ms of digest processing time.';
          $('<div></div>').text(footer).appendTo(detailsElement);
          detailsText = 'Total  Watch   Work Overhead  Function\n' + lines.map(function(text) {
            return text.replace(/[ \n]+/g, ' ');
          }).join('\n') + '\n' + footer + '\n';
        }
      };

      digestHud.enable = function() {
        var toggle = false;

        if (this.enabled) {
            return;
        }

        this.enabled = true;

        $provide.decorator('$rootScope', ['$delegate', function($delegate) {
          var proto = digestHud.original.$rootScope = Object.getPrototypeOf($delegate);

          digestHud.original.Digest = proto.$digest;
          digestHud.original.EvalAsync = proto.$evalAsync;
          digestHud.original.ApplyAsync = proto.$applyAsync;
          digestHud.original.PostDigest = proto.$$postDigest;
          digestHud.original.Watch = proto.$watch;
          digestHud.original.WatchGroup = proto.$watchGroup;

          // $watchCollection delegates to $watch, no extra processing necessary
          proto.$digest = instrumentedDigest;
          proto.$evalAsync = instrumentedEvalAsync;
          proto.$applyAsync = instrumentedApplyAsync;
          proto.$$postDigest = instrumentedPostDigest;
          proto.$watch = instrumentedWatch;
          proto.$watchGroup = instrumentedWatchGroup;

          var watchTiming;

          function instrumentedDigest() {
            // jshint validthis:true
            digestHud.timingStack.length = 0;
            this.$$postDigest(digestHud.flushTimingCycle);
            var start = Date.now();
            digestHud.inDigest = true;
            try {
              digestHud.original.Digest.call(this);
            } finally {
              digestHud.inDigest = false;
            }
            var duration = Date.now() - start;
            digestHud.overheadTiming.overhead += duration;
            toggle = !toggle;
            digestHud.digestTimings.push(duration);
            if (digestHud.digestTimings.length > digestHud.numDigestStats) digestHud.digestTimings.shift();
            var len = digestHud.digestTimings.length;
            var sorted = digestHud.digestTimings.slice().sort();
            var median = len % 2 ?
              sorted[(len - 1) / 2] : Math.round((sorted[len / 2] + sorted[len / 2 - 1]) / 2);
            var description =
              'digest ' + sorted[0] + 'ms ' + median + 'ms ' + sorted[len - 1] + 'ms ' +
              (toggle ? '\u25cf' : '\u25cb');

            if (digestHud.summaryElement) {
              digestHud.summaryElement.text(description);
            }
          }

          function instrumentedEvalAsync(expression, locals) {
            // jshint validthis:true
            var timing = digestHud.createTiming('$evalAsync(' + digestHud.formatExpression(expression) + ')');
            digestHud.original.EvalAsync.call(
              this, digestHud.wrapExpression(expression, timing, 'handle', true, true), locals);
          }

          function instrumentedApplyAsync(expression) {
            // jshint validthis:true
            var timing = digestHud.createTiming('$applyAsync(' + digestHud.formatExpression(expression) + ')');
            digestHud.original.ApplyAsync.call(this, digestHud.wrapExpression(expression, timing, 'handle', false, true));
          }

          function instrumentedPostDigest(fn) {
            // jshint validthis:true
            if (digestHud.timingStack.length) {
              fn = digestHud.wrapExpression(fn, digestHud.timingStack[digestHud.timingStack.length - 1], 'overhead', true, true);
            }
            digestHud.original.PostDigest.call(this, fn);
          }

          function instrumentedWatch(watchExpression, listener, objectEquality) {
            // jshint validthis:true
            var watchTimingSet = false;
            if (!watchTiming) {
              // Capture watch timing (and its key) once, before we descend in $$watchDelegates.
              watchTiming = digestHud.createTiming(digestHud.formatExpression(watchExpression));
              watchTimingSet = true;
            }
            try {
              if (angular.isString(watchExpression)) {
                if (!digestHud.$parse) {
                  angular.injector(['ng']).invoke(['$parse', function(parse) {digestHud.$parse = parse;}]);
                }
                watchExpression = digestHud.$parse(watchExpression);
              }
              if (watchExpression && watchExpression.$$watchDelegate) {
                return digestHud.original.Watch.call(this, watchExpression, listener, objectEquality);
              } else {
                return digestHud.original.Watch.call(
                  this, digestHud.wrapExpression(watchExpression, watchTiming, 'watch', true, false),
                  digestHud.wrapListener(listener, watchTiming), objectEquality);
              }
            } finally {
              if (watchTimingSet) watchTiming = null;
            }
          }

          function instrumentedWatchGroup(watchExpressions, listener) {
            // jshint validthis:true
            var watchTimingSet = false;
            if (!watchTiming) {
              // $watchGroup delegates to $watch for each expression, so just make sure to set the group's
              // aggregate key as the override first.
              watchTiming = digestHud.createTiming(
                '[' + watchExpressions.map(digestHud.formatExpression).join(', ') + ']');
              watchTimingSet = true;
            }
            try {
              return digestHud.original.WatchGroup.call(this, watchExpressions, listener);
            } finally {
              if (watchTimingSet) watchTiming = null;
            }
          }

          return $delegate;
        }]);

        $provide.decorator('$parse', ['$delegate', function($delegate) {
          return function(expression) {
            var result = $delegate.apply(this, arguments);
            if (angular.isString(expression)) result.exp = expression;
            return result;
          };
        }]);

        $provide.decorator('$q', ['$delegate', function($delegate) {
          var proto = digestHud.original.$q = Object.getPrototypeOf($delegate.defer().promise);
          digestHud.original.Then = proto.then;
          digestHud.original.Finally = proto.finally;
          proto.then = instrumentedThen;
          proto.finally = instrumentedFinally;

          function instrumentedThen(onFulfilled, onRejected, progressBack) {
            // jshint validthis:true
            return digestHud.original.Then.call(
              this,
              digestHud.wrapExpression(
                onFulfilled, digestHud.createTiming('$q(' + digestHud.formatExpression(onFulfilled) + ')'), 'handle',
                false, true),
              digestHud.wrapExpression(
                onRejected, digestHud.createTiming('$q(' + digestHud.formatExpression(onRejected) + ')'), 'handle',
                false, true),
              digestHud.wrapExpression(
                progressBack, digestHud.createTiming('$q(' + digestHud.formatExpression(progressBack) + ')'), 'handle',
                false, true)
            );
          }

          function instrumentedFinally(callback, progressBack) {
            // jshint validthis:true
            return digestHud.original.Finally.call(
              this,
              digestHud.wrapExpression(
                callback, digestHud.createTiming('$q(' + digestHud.formatExpression(callback) + ')'), 'handle',
                false, true),
              digestHud.wrapExpression(
                progressBack, digestHud.createTiming('$q(' + digestHud.formatExpression(callback) + ')'), 'handle',
                false, true)
            );
          }

          return $delegate;
        }]);

        digestHud.original.Bind = angular.bind;
        angular.bind = function(self, fn/*, args*/) {
          var result = digestHud.original.Bind.apply(this, arguments);
          result.exp = digestHud.formatExpression(fn);
          return result;
        };
      };

      digestHud.disable = function() {
          if (! this.enabled) {
              return;
          }

          if (digestHud.original.$rootScope) {
              var proto = digestHud.original.$rootScope;
              proto.$digest = digestHud.original.Digest;
              proto.$evalAsync = digestHud.original.EvalAsync;
              proto.$applyAsync = digestHud.original.ApplyAsync;
              proto.$$postDigest = digestHud.original.PostDigest;
              proto.$watch = digestHud.original.Watch;
              proto.$watchGroup = digestHud.original.WatchGroup;
          }

          if (digestHud.original.$q) {
              digestHud.original.$q.then = digestHud.original.Then;
              digestHud.original.$q.finally = digestHud.original.Finally;
          }

          angular.bind = digestHud.original.Bind;

          this.enabled = false;
      };

      digestHud.setHudPosition = function(position) {
        if (digestHud.hudElement) {
          // reset all to defaults
          var styles = {
            top: 'auto',
            right: 'auto',
            bottom: 'auto',
            left: 'auto'
          };
          position = position ? '' + position : digestHud.defaultHudPosition;
          position.split(' ').map(function(prop) { styles[prop] = 0; });
          digestHud.hudElement.css(styles);
        } else {
          // save and apply on enabled
          digestHud.customHudPosition = position;
        }
      };

      digestHud.percentage = function(value) {
        if (value >= 1) return (value * 100).toFixed(1) + '%';
        return ('\u2007\u2007' + (value * 100).toFixed(1) + '%').slice(-5);
      };

      digestHud.formatExpression = function(watchExpression) {
        if (!watchExpression) return '';
        if (angular.isString(watchExpression)) return watchExpression;
        if (angular.isString(watchExpression.exp)) return watchExpression.exp;
        if (watchExpression.name) return 'function ' + watchExpression.name + '() {\u2026}';
        return watchExpression.toString();
      };

      digestHud.wrapExpression = function(expression, timing, counter, flushCycle, endCycle) {
        if (!expression && !flushCycle) return expression;
        if (!digestHud.$parse) angular.injector(['ng']).invoke(['$parse', function(parse) {digestHud.$parse = parse;}]);
        var actualExpression = angular.isString(expression) ? digestHud.$parse(expression) : expression;
        return function instrumentedExpression() {
          if (flushCycle) digestHud.flushTimingCycle();
          if (!actualExpression) return null;
          if (!digestHud.inDigest) return actualExpression.apply(this, arguments);
          var start = Date.now();
          digestHud.timingStack.push(timing);
          timing.startCycle(start);
          try {
            return actualExpression.apply(digestHud, arguments);
          } finally {
            timing.countTime(counter, Date.now() - start);
            if (endCycle) timing.endCycle();
          }
        };
      };

      digestHud.wrapListener = function(listener, timing) {
        if (!listener) return listener;
        return function instrumentedListener() {
          var start = Date.now();
          try {
            return listener.apply(this, arguments);
          } finally {
            timing.countTime('handle', Date.now() - start);
          }
        };
      };

      digestHud.createTiming = function(key) {
        var timing = digestHud.watchTimings[key];
        if (!timing) timing = digestHud.watchTimings[key] = new WatchTiming(key);
        return timing;
      };

      digestHud.$get = function() {
          return digestHud;
      };
      digestHud.overheadTiming = digestHud.createTiming('$$ng-overhead');
    };

    angular.module('digestHud', []).provider('digestHud', ['$provide', function($provide) {
      return new DigestHud($provide);
    }]);
})(this);
