var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d10061-00a4-0050-000b-00ab005c0010.png",
        "timestamp": 1615674489709,
        "duration": 3086
    },
    {
        "description": "Debería crear un prestamo|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008e005c-0046-00a2-00de-009800360073.png",
        "timestamp": 1615674493590,
        "duration": 1026
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15608,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00250023-0046-001f-0092-004900820016.png",
        "timestamp": 1615679609889,
        "duration": 3246
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15608,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615679615043,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615679615043,
                "type": ""
            }
        ],
        "screenShotFile": "00d100ba-00bb-00a5-0048-00ab00e400da.png",
        "timestamp": 1615679614106,
        "duration": 981
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22896,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007200d1-0001-00d5-000b-00df004e0039.png",
        "timestamp": 1615679896447,
        "duration": 3080
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22896,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d60092-0056-009f-00e3-002a005800c0.png",
        "timestamp": 1615679900054,
        "duration": 198
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12612,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b002c-004e-00ed-00d6-00d800640083.png",
        "timestamp": 1615679943550,
        "duration": 3050
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12612,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c70056-00da-00c0-0040-00fd00c70059.png",
        "timestamp": 1615679947276,
        "duration": 175
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004100f6-0087-009b-008f-00bf0014001f.png",
        "timestamp": 1615680017436,
        "duration": 3228
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22660,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00420029-00df-003e-006c-003c0083005d.png",
        "timestamp": 1615680021198,
        "duration": 153
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac006f-00a0-00e7-0089-004600e800ed.png",
        "timestamp": 1615680074545,
        "duration": 3030
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11796,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00130058-0011-006e-0008-008400ae003f.png",
        "timestamp": 1615680078237,
        "duration": 143
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002200db-00d7-001e-006a-005f00580019.png",
        "timestamp": 1615680172623,
        "duration": 3279
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16284,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ea0075-0057-00a5-000a-00ec008000eb.png",
        "timestamp": 1615680176544,
        "duration": 142
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d00a8-0083-00a3-0053-0058005400f3.png",
        "timestamp": 1615680301739,
        "duration": 3189
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14464,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007500ac-008a-001f-006a-003f00980096.png",
        "timestamp": 1615680305528,
        "duration": 197
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19084,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600cb-00ac-004b-00dd-00a9005b00c9.png",
        "timestamp": 1615813945525,
        "duration": 2973
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19084,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00de00b6-0029-0090-0036-00a900a000af.png",
        "timestamp": 1615813949328,
        "duration": 157
    },
    {
        "description": "should display welcome message|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16332,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Login' to equal 'Bienvenido a Bibliotecario'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:13:33)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009d0012-00d4-000d-007b-00e5000200cc.png",
        "timestamp": 1615915554349,
        "duration": 2978
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16332,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee0072-0027-00c3-0089-002b004d0070.png",
        "timestamp": 1615915557833,
        "duration": 161
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f400ae-0062-00e0-0067-00e200a30076.png",
        "timestamp": 1615919136711,
        "duration": 899
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1568,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c5000c-00e9-005b-00ed-009a005e00f0.png",
        "timestamp": 1615919138390,
        "duration": 189
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14052,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00820076-0047-0059-0017-00f100c10042.png",
        "timestamp": 1615919271863,
        "duration": 2303
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17396,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00ae-00a2-0038-00dd-007000ad00bd.png",
        "timestamp": 1615920147718,
        "duration": 923
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f000f3-0081-0038-00a4-008d00f500f6.png",
        "timestamp": 1615921967086,
        "duration": 795
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10904,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:16:38)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615921968114,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615921968115,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615921969225,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615921969226,
                "type": ""
            }
        ],
        "screenShotFile": "00c2003d-004e-00a8-00f3-00b0008c00e5.png",
        "timestamp": 1615921968396,
        "duration": 883
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640000-0049-001d-0025-00bb002b0079.png",
        "timestamp": 1615922105090,
        "duration": 896
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002b00e7-008d-0092-005f-005700f10027.png",
        "timestamp": 1615922106455,
        "duration": 893
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00db0065-0013-0078-004b-00bf00c80096.png",
        "timestamp": 1615922126321,
        "duration": 1486
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15536,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee00a7-00cc-0099-00a5-00ad00f700bf.png",
        "timestamp": 1615922128273,
        "duration": 906
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16812,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004100d0-0025-00a5-00fc-008200b10037.png",
        "timestamp": 1615922178615,
        "duration": 6448
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16812,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003300d8-0065-0012-00d7-0058000b00ad.png",
        "timestamp": 1615922185511,
        "duration": 860
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010022-000b-00ec-00d9-004a003900da.png",
        "timestamp": 1615923248262,
        "duration": 934
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14380,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923249315,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923249317,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923250854,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923250854,
                "type": ""
            }
        ],
        "screenShotFile": "008200aa-0061-0006-00c6-009300b10068.png",
        "timestamp": 1615923250046,
        "duration": 1188
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10552,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d900df-0017-002e-00ae-00e000ec000b.png",
        "timestamp": 1615923309128,
        "duration": 912
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10552,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923310142,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923310143,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923311346,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923311346,
                "type": ""
            }
        ],
        "screenShotFile": "005e00de-00b7-00db-0074-006e00a60025.png",
        "timestamp": 1615923310508,
        "duration": 1167
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d1009a-00c2-00e1-00c0-004900900088.png",
        "timestamp": 1615923359665,
        "duration": 920
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923360703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923360704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923361898,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923361899,
                "type": ""
            }
        ],
        "screenShotFile": "002900be-00d9-0066-0058-007200190049.png",
        "timestamp": 1615923361052,
        "duration": 1190
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0059009d-006f-00d2-0074-00a5009200c4.png",
        "timestamp": 1615923649085,
        "duration": 2102
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6096,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923651257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923651257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923652461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923652461,
                "type": ""
            }
        ],
        "screenShotFile": "003000f3-0092-0038-0087-0087000300ed.png",
        "timestamp": 1615923651643,
        "duration": 1120
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15744,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b40063-00c9-0058-0058-00e800e000f7.png",
        "timestamp": 1615923762706,
        "duration": 799
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15744,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923763713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923763715,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923764794,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923764794,
                "type": ""
            }
        ],
        "screenShotFile": "005e0085-001b-0086-00ee-00b600af0016.png",
        "timestamp": 1615923763990,
        "duration": 1154
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b3002c-0088-00fa-001f-001b00c80059.png",
        "timestamp": 1615923890233,
        "duration": 917
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4412,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923891232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923891232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615923892490,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615923892490,
                "type": ""
            }
        ],
        "screenShotFile": "00850028-00e8-00d4-000c-006000a1009e.png",
        "timestamp": 1615923891630,
        "duration": 1203
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200ed-0032-005f-00e7-00fc002e00c3.png",
        "timestamp": 1615924007578,
        "duration": 935
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:19:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924008608,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924008609,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924009829,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924009829,
                "type": ""
            }
        ],
        "screenShotFile": "007c002c-0025-008b-0048-00d700f800ae.png",
        "timestamp": 1615924009021,
        "duration": 1047
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f100f9-000e-0039-0022-006e004a0045.png",
        "timestamp": 1615924272009,
        "duration": 824
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:18:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924273069,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924273070,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924274164,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924274165,
                "type": ""
            }
        ],
        "screenShotFile": "0049002b-0040-00dc-002a-00dc005f0040.png",
        "timestamp": 1615924273310,
        "duration": 866
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a006a-00c0-0020-00b0-005a00580044.png",
        "timestamp": 1615924325194,
        "duration": 1750
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to equal 'El email es obligatorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:18:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924327149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924327150,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924328209,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924328209,
                "type": ""
            }
        ],
        "screenShotFile": "004b004b-003f-000a-009b-0092009b0079.png",
        "timestamp": 1615924327426,
        "duration": 941
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18680,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad00f3-005b-00a4-00e8-007a00e2007c.png",
        "timestamp": 1615924991831,
        "duration": 974
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18680,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:17:39)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924992906,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924992906,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615924994137,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615924994138,
                "type": ""
            }
        ],
        "screenShotFile": "00b6003d-00c8-00af-00f7-00f0007f005f.png",
        "timestamp": 1615924993281,
        "duration": 915
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18424,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670039-0027-003b-00f2-001800c800ad.png",
        "timestamp": 1615925098938,
        "duration": 930
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18424,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected undefined to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:21:22)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615925099968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615925099969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2557:8 \"[WDS] Warnings while compiling.\"",
                "timestamp": 1615925101187,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "http://localhost:4200/polyfills.js 2566:10 \"Emitted no files.\\r\\n\"",
                "timestamp": 1615925101187,
                "type": ""
            }
        ],
        "screenShotFile": "00700064-0020-00c6-007a-009c0098005a.png",
        "timestamp": 1615925100356,
        "duration": 918
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0077001f-00e6-0040-006a-001c00b500ee.png",
        "timestamp": 1615926174051,
        "duration": 911
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10668,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00f1-0081-00d0-0072-001a00ac0010.png",
        "timestamp": 1615926175445,
        "duration": 1026
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a80024-00b6-00fb-00af-005d000200d6.png",
        "timestamp": 1615926298630,
        "duration": 805
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12992,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El email es obligatorio' to equal 'El email es obligario'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:20:22)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00060054-0072-00ad-00b1-00c000430017.png",
        "timestamp": 1615926299924,
        "duration": 912
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0033-00be-0035-0018-005700610041.png",
        "timestamp": 1615926351023,
        "duration": 941
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18372,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0055002c-00a4-005a-00c1-008700660068.png",
        "timestamp": 1615926352451,
        "duration": 966
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7648,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f600c4-00c6-0036-0084-0055005e0031.png",
        "timestamp": 1615926552830,
        "duration": 915
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7648,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0008007f-0039-0021-005b-005b00c7004d.png",
        "timestamp": 1615926554234,
        "duration": 780
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0013009b-00e5-0041-005c-00e0004c0069.png",
        "timestamp": 1615926585395,
        "duration": 771
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5112,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d30032-00b1-0020-0066-00580017008f.png",
        "timestamp": 1615926586655,
        "duration": 891
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19136,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00380090-0041-0080-00a9-0080004f00dd.png",
        "timestamp": 1615926768776,
        "duration": 885
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19136,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c006d-0047-0054-0050-00fa00b80057.png",
        "timestamp": 1615926770329,
        "duration": 1095
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a60067-005b-004a-004f-00ea00e10034.png",
        "timestamp": 1615927781914,
        "duration": 892
    },
    {
        "description": "debería mostrar mensajes de requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c70015-0066-0092-001d-0096007e007c.png",
        "timestamp": 1615927783267,
        "duration": 912
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19336,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009c00f8-00c0-004f-00d2-000e00cf001a.png",
        "timestamp": 1615927784471,
        "duration": 955
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0072-0036-00dc-00cc-00af00c00020.png",
        "timestamp": 1615928089335,
        "duration": 889
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0020009b-00bd-0016-001e-00cb00f60004.png",
        "timestamp": 1615928090693,
        "duration": 916
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003000df-0026-0085-00cc-00fd00990027.png",
        "timestamp": 1615928091937,
        "duration": 816
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18692,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001300f7-0053-0056-0030-000e00390048.png",
        "timestamp": 1615928093042,
        "duration": 900
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0050003c-00e6-00db-0028-008f00a800e7.png",
        "timestamp": 1615928128537,
        "duration": 797
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e0010-005c-0016-00d7-00610065001a.png",
        "timestamp": 1615928129830,
        "duration": 851
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280060-001f-00f1-0066-005a00d9002e.png",
        "timestamp": 1615928157981,
        "duration": 772
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c0010-004b-00dd-007d-009e008d0016.png",
        "timestamp": 1615928159258,
        "duration": 769
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003600db-0028-0032-0052-005c00020070.png",
        "timestamp": 1615928160339,
        "duration": 200
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9596,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0014003a-0018-0063-00fc-0089009300ce.png",
        "timestamp": 1615928160860,
        "duration": 180
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f00f1-0098-0058-0021-00410045007e.png",
        "timestamp": 1615928675428,
        "duration": 1972
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f30073-000a-0049-0093-0017004400be.png",
        "timestamp": 1615928677934,
        "duration": 966
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe00d7-0057-00f0-00af-003800aa00f0.png",
        "timestamp": 1615928679228,
        "duration": 5204
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15996,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00640092-005b-005e-00d2-001f00630079.png",
        "timestamp": 1615928684754,
        "duration": 187
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00680006-00ba-004e-00e5-000e00f400f9.png",
        "timestamp": 1615928919464,
        "duration": 1123
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002600ab-00d0-0081-00ae-00ef00f50096.png",
        "timestamp": 1615928921104,
        "duration": 991
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d0000a-004d-00b9-0092-0071009a00b1.png",
        "timestamp": 1615928922413,
        "duration": 5213
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5140,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00730082-00f6-0023-005b-0029007900c8.png",
        "timestamp": 1615928927904,
        "duration": 189
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006400eb-003c-0023-0037-007f003800f4.png",
        "timestamp": 1615928935734,
        "duration": 1194
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980096-007c-004e-00ea-00b300490083.png",
        "timestamp": 1615928937395,
        "duration": 933
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000f00df-00ba-0059-0077-007b00b200be.png",
        "timestamp": 1615928938624,
        "duration": 5210
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00050009-0012-00fe-0062-0062007900e4.png",
        "timestamp": 1615928944095,
        "duration": 183
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0071002a-005d-0002-008b-007800cd0009.png",
        "timestamp": 1615929017855,
        "duration": 823
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11160,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d400d5-001c-0037-0052-00a40045009c.png",
        "timestamp": 1615929019209,
        "duration": 6008
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d200ae-007a-00d5-0094-000c008a002b.png",
        "timestamp": 1615929042091,
        "duration": 935
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5208,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El email es obligatorio' to equal 'Ingrese un email válido'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:34:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb003a-0065-002c-00cc-00e800ee0094.png",
        "timestamp": 1615929043515,
        "duration": 6014
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b00cb-00a9-00d8-008b-009c000d00a9.png",
        "timestamp": 1615929078663,
        "duration": 929
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14436,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb00b0-001f-00ac-006d-008c001d00e7.png",
        "timestamp": 1615929080077,
        "duration": 5987
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2864,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00b6-006e-006d-00c4-008d006a0023.png",
        "timestamp": 1615930302653,
        "duration": 805
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009400cf-0042-003e-0004-004e009e00c7.png",
        "timestamp": 1615932006387,
        "duration": 914
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3480,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b0076-0044-00e6-00cf-000600610042.png",
        "timestamp": 1615932008276,
        "duration": 828
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f40003-006e-0006-00fe-001900fa003c.png",
        "timestamp": 1615932075519,
        "duration": 28093
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0011-00cd-00b8-0066-00b800a00062.png",
        "timestamp": 1615932104071,
        "duration": 682
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3984,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003400c1-007f-00c6-0014-003f00a0001b.png",
        "timestamp": 1615932105066,
        "duration": 872
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490027-00d4-0096-000f-00be00710066.png",
        "timestamp": 1615932142531,
        "duration": 18776
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e00d8-00a0-0006-0037-000d00d100a0.png",
        "timestamp": 1615932161818,
        "duration": 941
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'Ingrese un email válido' to be falsy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:32:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "004c00c3-008d-00e3-00b5-002f003300cc.png",
        "timestamp": 1615932163098,
        "duration": 973
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a0079-00d6-0039-0086-002400f80084.png",
        "timestamp": 1615932206869,
        "duration": 4474
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f009e-00a0-0069-00d1-0008002d0058.png",
        "timestamp": 1615932211855,
        "duration": 783
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13364,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009900cf-0010-00ba-0089-003b00fe008a.png",
        "timestamp": 1615932212963,
        "duration": 981
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008100d7-0041-00a9-002d-0046000f00b6.png",
        "timestamp": 1615932273876,
        "duration": 18962
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00180087-00bd-006f-008c-002e002d0056.png",
        "timestamp": 1615932293351,
        "duration": 836
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee00bb-007c-0041-005b-00de009d0038.png",
        "timestamp": 1615932294526,
        "duration": 979
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20924,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000500d3-0064-00dd-00b8-00ca00a800fc.png",
        "timestamp": 1615932295831,
        "duration": 859
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0058009b-00c4-00d4-008a-000000f40093.png",
        "timestamp": 1615934187880,
        "duration": 19253
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c0056-00d9-003e-00ee-00d7009d00a1.png",
        "timestamp": 1615934207617,
        "duration": 926
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b40087-00f3-0093-0009-001700e200fe.png",
        "timestamp": 1615934208879,
        "duration": 992
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a9006b-00ff-0026-00da-00b000520069.png",
        "timestamp": 1615934210212,
        "duration": 790
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11356,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la página de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:49:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/home - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1615934212487,
                "type": ""
            }
        ],
        "screenShotFile": "0049003b-000e-008d-0090-00af003800d8.png",
        "timestamp": 1615934211299,
        "duration": 11408
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00440004-007d-0039-0059-00ff00d2000b.png",
        "timestamp": 1615934358151,
        "duration": 21285
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c00015-0034-0002-00b4-009400e5005b.png",
        "timestamp": 1615934379935,
        "duration": 950
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008e0049-006e-0066-00fb-002600e80006.png",
        "timestamp": 1615934381212,
        "duration": 986
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00ef-002d-008b-0051-009b00b100c0.png",
        "timestamp": 1615934382538,
        "duration": 886
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14716,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page http://localhost:4200/home. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"redirecciona a la página de home si login es valido\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:49:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://localhost:4200/home - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1615934384913,
                "type": ""
            }
        ],
        "screenShotFile": "008f00cc-00a5-00ac-006a-002000d000a0.png",
        "timestamp": 1615934383751,
        "duration": 11413
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c000f1-0051-0032-002c-00b300fc007d.png",
        "timestamp": 1615937593279,
        "duration": 2637
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00130044-006a-00de-00d7-0009005400db.png",
        "timestamp": 1615937596663,
        "duration": 965
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0093-00e9-008e-0014-006c002800af.png",
        "timestamp": 1615937597941,
        "duration": 971
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f0099-00fc-003a-00c0-0008004f00e3.png",
        "timestamp": 1615937599201,
        "duration": 908
    },
    {
        "description": "Debería mostrar mensajes de requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21156,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007e00c7-0085-008b-00d0-00d8008b00b9.png",
        "timestamp": 1615937600399,
        "duration": 174
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c30026-00c4-0005-0022-0072004c00eb.png",
        "timestamp": 1615937630426,
        "duration": 810
    },
    {
        "description": "debería mostrar mensaje error email requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0070005b-001c-009f-0099-00e0002200d2.png",
        "timestamp": 1615937631729,
        "duration": 924
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a00e5-00d1-00f9-0073-007800af00c9.png",
        "timestamp": 1615937632976,
        "duration": 887
    },
    {
        "description": "muestra mensaje error password requerido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005400a1-0055-0061-0013-001e001900d1.png",
        "timestamp": 1615937634200,
        "duration": 1010
    },
    {
        "description": "Debería mostrar mensaje ISB requerido|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17836,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0027001b-00bd-00e2-0017-00cd003100be.png",
        "timestamp": 1615937635504,
        "duration": 172
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00560039-00e0-0074-00bf-0006008200c1.png",
        "timestamp": 1615938742797,
        "duration": 3386
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c008c-00fd-0034-00ec-006d002f008b.png",
        "timestamp": 1615938746683,
        "duration": 949
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00580039-0015-0098-000a-004b001900df.png",
        "timestamp": 1615938747939,
        "duration": 954
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18456,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected 'El password es obligatorio' to equal 'El password es obligatobligatorioorio'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\login.e2e-spec.ts:46:21)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "001800f7-0058-0069-00ee-00b800cc007e.png",
        "timestamp": 1615938749187,
        "duration": 898
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004400e4-003b-0054-0074-00cb0048009a.png",
        "timestamp": 1615938788143,
        "duration": 856
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d0095-007b-003f-0078-008a00ed006a.png",
        "timestamp": 1615938789469,
        "duration": 921
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0090000a-007b-0092-001a-0071004c00b5.png",
        "timestamp": 1615938790703,
        "duration": 999
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3116,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0071008b-0036-00e0-002b-002b00810019.png",
        "timestamp": 1615938791977,
        "duration": 916
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b500d5-0032-0018-004d-00fd00c500ee.png",
        "timestamp": 1615938907041,
        "duration": 799
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160049-002a-0067-007e-00cb00c80015.png",
        "timestamp": 1615938908424,
        "duration": 875
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d400f0-000f-00b3-007f-003a00df00f6.png",
        "timestamp": 1615938909620,
        "duration": 853
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba005e-008c-007a-00ae-006c0069006c.png",
        "timestamp": 1615938910747,
        "duration": 983
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd0020-004a-0071-005c-009600a8009e.png",
        "timestamp": 1615938912029,
        "duration": 173
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20024,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fd00a1-00cf-00fe-00d1-0075003f0085.png",
        "timestamp": 1615938912493,
        "duration": 131
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d60091-002b-00ba-003e-0001005400a6.png",
        "timestamp": 1615940429303,
        "duration": 794
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500eb-0096-0001-008a-00b7007e00bb.png",
        "timestamp": 1615940430614,
        "duration": 997
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030092-006f-0014-00af-009100a80069.png",
        "timestamp": 1615940431929,
        "duration": 996
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da0032-0086-0041-0082-0041006300b0.png",
        "timestamp": 1615940433206,
        "duration": 788
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f600cd-0053-00ac-008e-007f004e009c.png",
        "timestamp": 1615940434283,
        "duration": 5350
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b1000e-008d-002c-0041-00cb00ef00d3.png",
        "timestamp": 1615940439911,
        "duration": 652
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004f00e8-0069-00fd-00fb-007d00d700cf.png",
        "timestamp": 1615940440873,
        "duration": 201
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a10044-000e-0071-00a7-000200da0007.png",
        "timestamp": 1615940504971,
        "duration": 28037
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003000f1-0035-006d-003e-005f001d00f0.png",
        "timestamp": 1615940533519,
        "duration": 929
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd0070-00fb-008d-00e6-00cc003500cb.png",
        "timestamp": 1615940534782,
        "duration": 855
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0063004f-00a7-0004-000d-000b00160044.png",
        "timestamp": 1615940536000,
        "duration": 919
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0064-00af-0024-0056-003400e60035.png",
        "timestamp": 1615940537242,
        "duration": 1895
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d8001b-0078-00b1-0070-009500970071.png",
        "timestamp": 1615940539470,
        "duration": 103
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18712,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007a009a-00d0-0090-00ec-00f7005000d6.png",
        "timestamp": 1615940539893,
        "duration": 299
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e0037-00d1-001d-002c-005200390092.png",
        "timestamp": 1615983348470,
        "duration": 1092
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e0074-0069-00e2-00ca-008700ba009f.png",
        "timestamp": 1615983350448,
        "duration": 961
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00540013-0011-005c-005c-00620056002c.png",
        "timestamp": 1615983351754,
        "duration": 983
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c60063-00c9-001e-00f5-001f00f40087.png",
        "timestamp": 1615983353065,
        "duration": 917
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600d0-009d-0046-0072-00f6006b0055.png",
        "timestamp": 1615983354303,
        "duration": 2042
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80065-00c0-004d-003d-009b00260086.png",
        "timestamp": 1615983356647,
        "duration": 114
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19324,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000400ba-00a7-008f-005f-004300bd007e.png",
        "timestamp": 1615983357066,
        "duration": 567
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Expected null to be truthy."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\app.e2e-spec.ts:12:31)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00d70022-001f-00dc-00b5-009100f40078.png",
        "timestamp": 1615983975093,
        "duration": 917
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0001004c-0065-006f-00a9-004500da0000.png",
        "timestamp": 1615983976532,
        "duration": 1059
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0097-0053-005c-00ed-0044001b0093.png",
        "timestamp": 1615983977925,
        "duration": 1086
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00900046-00c3-00d1-0051-00d700ae00c7.png",
        "timestamp": 1615983979370,
        "duration": 1173
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b00d3-002b-00f7-00a3-00a000a40057.png",
        "timestamp": 1615983980897,
        "duration": 2426
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010036-008b-003f-007e-008f00590059.png",
        "timestamp": 1615983983658,
        "duration": 138
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14484,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a500a1-0029-00b8-00a4-0055001800bb.png",
        "timestamp": 1615983984135,
        "duration": 157
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b6003a-0023-0057-0075-00a500f700ca.png",
        "timestamp": 1615984541275,
        "duration": 1033
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd006d-009e-001b-0093-00c000f3002f.png",
        "timestamp": 1615984542855,
        "duration": 887
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce007c-00d5-0054-00df-006100cd00bf.png",
        "timestamp": 1615984544053,
        "duration": 971
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00340025-003d-005f-008d-00cb00ff0078.png",
        "timestamp": 1615984545322,
        "duration": 939
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640047-00f6-0050-0064-00fc007d0070.png",
        "timestamp": 1615984546586,
        "duration": 1988
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c007a-0011-0017-009e-002d005f00e9.png",
        "timestamp": 1615984548983,
        "duration": 176
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5768,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e40097-00e7-006c-00f9-003e00280065.png",
        "timestamp": 1615984549475,
        "duration": 127
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00710027-00ad-008d-0037-0020003b00cc.png",
        "timestamp": 1615985039844,
        "duration": 1292
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d80016-002f-00c1-001d-000d00570098.png",
        "timestamp": 1615985041836,
        "duration": 1185
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670031-0028-001f-0085-001500470083.png",
        "timestamp": 1615985043344,
        "duration": 1056
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700ae-0000-007f-0049-000400960046.png",
        "timestamp": 1615985044752,
        "duration": 966
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00630054-00db-00ad-00fe-00ba005c00c3.png",
        "timestamp": 1615985046071,
        "duration": 2143
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d0000b-00fd-0084-00c8-00ad00a3009a.png",
        "timestamp": 1615985048537,
        "duration": 111
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18884,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e001d-0070-001b-00f4-007e00ac00b3.png",
        "timestamp": 1615985048953,
        "duration": 107
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d2007f-0087-004d-00de-0031002e0097.png",
        "timestamp": 1615985662050,
        "duration": 804
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dd007b-0089-00f8-0099-0065008c0036.png",
        "timestamp": 1615985663376,
        "duration": 918
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000b0048-00a0-0093-0047-000b003a00b6.png",
        "timestamp": 1615985664601,
        "duration": 916
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200e9-0090-0030-00bb-0069006100e4.png",
        "timestamp": 1615985665872,
        "duration": 1177
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005700a7-0056-000e-007c-007a00c2000b.png",
        "timestamp": 1615985667401,
        "duration": 2204
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: protractor_1.browser.addCookie is not a function"
        ],
        "trace": [
            "TypeError: protractor_1.browser.addCookie is not a function\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b1002e-00e3-005b-0095-00da006b002c.png",
        "timestamp": 1615985669962,
        "duration": 187
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3500,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: protractor_1.browser.addCookie is not a function"
        ],
        "trace": [
            "TypeError: protractor_1.browser.addCookie is not a function\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "003b0097-001c-0034-0003-004500ec00f2.png",
        "timestamp": 1615985670486,
        "duration": 120
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b20037-00cf-00e9-0012-0066001a001d.png",
        "timestamp": 1615987145304,
        "duration": 890
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00e700ec-003e-0052-0029-0014002b0039.png",
        "timestamp": 1615987147000,
        "duration": 0
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00cf00fc-000e-0024-0046-009a008900f1.png",
        "timestamp": 1615987147028,
        "duration": 0
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00990063-00b9-00bd-00e1-00cc000b004f.png",
        "timestamp": 1615987147060,
        "duration": 0
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": false,
        "pending": true,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Pending",
        "browserLogs": [],
        "screenShotFile": "00020018-0024-0051-002f-00a1007e00e8.png",
        "timestamp": 1615987147080,
        "duration": 0
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'http://localhost:4200/login' to match 'home'."
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:23:37)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00b90032-00b0-00f4-00c3-0015005d0037.png",
        "timestamp": 1615987147103,
        "duration": 131
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9132,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)",
            "Expected 'http://localhost:4200/login' to match 'home'."
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:34:37)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "0021006f-00da-00bb-0015-00bb00df0047.png",
        "timestamp": 1615987147561,
        "duration": 110
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b009c-00ad-00aa-006b-004800e9009c.png",
        "timestamp": 1615987177297,
        "duration": 1423
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002500d7-00d4-004b-008d-0080001d0018.png",
        "timestamp": 1615987179242,
        "duration": 928
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a1008a-00c3-0038-0001-0045003b00b4.png",
        "timestamp": 1615987180513,
        "duration": 972
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d80050-0055-00c4-0071-0070004d0019.png",
        "timestamp": 1615987181800,
        "duration": 958
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00750005-00b0-00e4-0027-001200d5005b.png",
        "timestamp": 1615987183059,
        "duration": 1888
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00310031-001d-00b2-0065-00c500c4003b.png",
        "timestamp": 1615987185310,
        "duration": 221
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 964,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0020005f-00e3-0069-0010-009700820063.png",
        "timestamp": 1615987185871,
        "duration": 146
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700b2-00b7-00dc-0084-003600ca0099.png",
        "timestamp": 1615987241346,
        "duration": 991
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd00e2-00fa-00cf-0074-00fc00860093.png",
        "timestamp": 1615987243110,
        "duration": 1283
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200ec-00ec-004e-009f-00620012005e.png",
        "timestamp": 1615987244762,
        "duration": 1094
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d90075-00b8-006e-0098-009100160096.png",
        "timestamp": 1615987246209,
        "duration": 893
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006200bc-0047-008b-00bc-000c00d600e2.png",
        "timestamp": 1615987247378,
        "duration": 1991
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00410098-0021-00af-008a-005b008700af.png",
        "timestamp": 1615987249668,
        "duration": 136
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1628,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=89.0.4389.82)\n  (Driver info: chromedriver=89.0.4389.23 (61b08ee2c50024bab004e48d2b1b083cdbdac579-refs/branch-heads/4389@{#294}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(home)\n    at Driver.schedule (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:12:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:10:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a300cb-0044-0067-009e-000d004d0074.png",
        "timestamp": 1615987250128,
        "duration": 109
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990099-003c-005e-00e7-005e0025008a.png",
        "timestamp": 1615987412179,
        "duration": 1030
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bd00f6-00e1-008b-00bd-007500550082.png",
        "timestamp": 1615987413960,
        "duration": 1050
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0053006b-00db-003b-002c-0016007e00d0.png",
        "timestamp": 1615987415359,
        "duration": 1056
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e100a4-00f8-00d5-00e0-002c00de005b.png",
        "timestamp": 1615987416725,
        "duration": 914
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d30013-0037-00c9-0050-004300b90018.png",
        "timestamp": 1615987417948,
        "duration": 1792
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008000e6-00ec-0081-0062-00d700b000d3.png",
        "timestamp": 1615987420064,
        "duration": 138
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11244,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d0099-007c-0091-00f6-008500110067.png",
        "timestamp": 1615987420540,
        "duration": 179
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab00da-00b9-0013-0084-00cb0095002e.png",
        "timestamp": 1615988225836,
        "duration": 1014
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f500e9-0049-00b1-00ea-0070009f00ff.png",
        "timestamp": 1615988227318,
        "duration": 875
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0060005b-004a-00f9-00bc-008e00e70095.png",
        "timestamp": 1615988228517,
        "duration": 962
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430042-00b3-00cf-0096-0089003f00e5.png",
        "timestamp": 1615988229776,
        "duration": 897
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e600a7-006c-0086-00e7-0032008400cb.png",
        "timestamp": 1615988230962,
        "duration": 2003
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003f00dd-0069-00d9-00fa-00c6002100d0.png",
        "timestamp": 1615988233289,
        "duration": 131
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2860,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0059000f-00ed-0021-0064-00e200ce0071.png",
        "timestamp": 1615988233744,
        "duration": 125
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0044003d-0045-0037-00e1-00c0002700ec.png",
        "timestamp": 1615988317484,
        "duration": 964
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c30002-002d-00fe-00c5-00f800630078.png",
        "timestamp": 1615988318959,
        "duration": 944
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00040075-006d-00ac-0025-005e00db0014.png",
        "timestamp": 1615988320214,
        "duration": 1091
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00370013-00ea-00fe-0081-0029006a001d.png",
        "timestamp": 1615988321603,
        "duration": 902
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c0082-005d-0088-001f-0072005100ed.png",
        "timestamp": 1615988322810,
        "duration": 1634
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee000a-00e7-009a-002b-00d700ef0041.png",
        "timestamp": 1615988324713,
        "duration": 132
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13108,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00920045-0055-00c3-00e5-0056007900fc.png",
        "timestamp": 1615988325116,
        "duration": 113
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003900e5-0092-0030-00d8-00eb00d40048.png",
        "timestamp": 1615988376720,
        "duration": 939
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0083007a-008c-0066-008e-009d00ec0002.png",
        "timestamp": 1615988378148,
        "duration": 928
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b00a7-00c2-00a3-0015-00bd00a80006.png",
        "timestamp": 1615988379369,
        "duration": 960
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b70015-00cc-002f-00ba-009c00e9007a.png",
        "timestamp": 1615988380628,
        "duration": 984
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00450056-0028-000b-00cc-000100df008a.png",
        "timestamp": 1615988381927,
        "duration": 1948
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e5008e-0028-00e2-0014-005d0053008e.png",
        "timestamp": 1615988384195,
        "duration": 30186
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16772,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ae004d-0005-00d7-00da-00f600ab00ed.png",
        "timestamp": 1615988414692,
        "duration": 154
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e0029-00a2-00c1-002b-00d000ed00ea.png",
        "timestamp": 1615988444204,
        "duration": 816
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460068-0069-0036-00c4-0062005800f2.png",
        "timestamp": 1615988445516,
        "duration": 965
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba00a6-00ca-00b9-00f1-007900950053.png",
        "timestamp": 1615988446843,
        "duration": 1015
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730059-003b-0004-00e1-005c00720066.png",
        "timestamp": 1615988448153,
        "duration": 962
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f70099-00a7-0018-00c7-0023006b00aa.png",
        "timestamp": 1615988449455,
        "duration": 1901
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "009400f4-00c3-0003-00b0-003e00cb0006.png",
        "timestamp": 1615988451636,
        "duration": 50231
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14976,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0070008b-006c-004f-000a-004400c400e7.png",
        "timestamp": 1615988502164,
        "duration": 154
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700cc-0099-0003-00b7-00dd00bc0062.png",
        "timestamp": 1615988738311,
        "duration": 985
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0010-0005-0042-001f-00ef00af00d8.png",
        "timestamp": 1615988739812,
        "duration": 963
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c007a-0098-00d6-00e9-00bd00230017.png",
        "timestamp": 1615988741122,
        "duration": 1117
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b90002-000f-004d-00ee-001d00e100d5.png",
        "timestamp": 1615988742584,
        "duration": 930
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004000f0-0095-009b-00f7-00e700bf00a0.png",
        "timestamp": 1615988743816,
        "duration": 2141
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "002900f5-00cc-00dc-007b-008800730001.png",
        "timestamp": 1615988746231,
        "duration": 50183
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10588,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00680099-005a-0091-0088-00ba005c00a7.png",
        "timestamp": 1615988796721,
        "duration": 111
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004600cb-0083-00bd-00db-00a4009c00b7.png",
        "timestamp": 1615988886753,
        "duration": 3361
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b00d6-0097-0057-006e-001a006b00fa.png",
        "timestamp": 1615988890615,
        "duration": 790
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100fa-0002-0027-002a-000500af008f.png",
        "timestamp": 1615988891718,
        "duration": 1044
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0073000d-0003-0079-0078-00330066009e.png",
        "timestamp": 1615988893106,
        "duration": 1062
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16816,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e001e-00a7-005d-009f-000f004a00a5.png",
        "timestamp": 1615988894461,
        "duration": 2951
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a50028-0054-0056-0066-00af00b30060.png",
        "timestamp": 1615989614882,
        "duration": 873
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f60005-003f-00f7-00b8-00a100310050.png",
        "timestamp": 1615989616304,
        "duration": 1091
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00bb-005b-00b8-00ca-008d00750025.png",
        "timestamp": 1615989617720,
        "duration": 1352
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700b7-0098-00bb-00cb-008f00f40077.png",
        "timestamp": 1615989619414,
        "duration": 1087
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000100c0-0049-005a-000a-005200fa0061.png",
        "timestamp": 1615989620786,
        "duration": 2400
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc0043-0009-00b2-0099-003c00c50040.png",
        "timestamp": 1615989623487,
        "duration": 140
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16192,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008400fe-002a-00a3-00f5-001200aa000e.png",
        "timestamp": 1615989623920,
        "duration": 147
    },
    {
        "description": "debería mostrar página de login|workspace-project App",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460055-00a8-006a-00eb-009b006a00ca.png",
        "timestamp": 1615994061032,
        "duration": 960
    },
    {
        "description": "debería mostrar mensaje error email obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008e00ac-000f-0046-0039-0013007c00d8.png",
        "timestamp": 1615994062814,
        "duration": 822
    },
    {
        "description": "debería mostrar mensaje error email no valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a1008f-00e7-00c8-0022-007b00e4002a.png",
        "timestamp": 1615994063954,
        "duration": 996
    },
    {
        "description": "muestra mensaje error password obligatorio|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700e4-00c7-0064-004e-007c0012007f.png",
        "timestamp": 1615994065266,
        "duration": 934
    },
    {
        "description": "redirecciona a la página de home si login es valido|work-space project login",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004700df-000a-00b4-0017-00d700070092.png",
        "timestamp": 1615994066482,
        "duration": 2521
    },
    {
        "description": "Debería mostrar mensaje ISBN obligatorio|workspace-project Prestamo",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, #isbnPrestamo)"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, #isbnPrestamo)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error: \n    at ElementArrayFinder.applyAction_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at PrestamoPage.setIsbn (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\page\\prestamo\\prestamo.po.ts:10:29)\n    at UserContext.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:23:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Debería mostrar mensaje ISBN obligatorio\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError: \n    at Suite.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:19:3)\n    at addSpecsToSuite (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\juan.alzate\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proyectos\\ADNCeiba\\angular-base\\e2e\\src\\test\\prestamo.e2e-spec.ts:7:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Module.m._compile (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:439:23)\n    at Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Object.require.extensions.<computed> [as .ts] (D:\\Proyectos\\ADNCeiba\\angular-base\\node_modules\\ts-node\\src\\index.ts:442:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0066001e-0033-00da-00d4-005300870020.png",
        "timestamp": 1615994069330,
        "duration": 47
    },
    {
        "description": "Muestra mensaje error Nombre obligatorio|workspace-project Prestamo",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18268,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.82"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007900a6-0094-0015-005e-00510005004d.png",
        "timestamp": 1615994069698,
        "duration": 105
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
