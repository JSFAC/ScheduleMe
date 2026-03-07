/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./pages/_app.tsx":
/*!************************!*\
  !*** ./pages/_app.tsx ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ App)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/router */ \"./node_modules/next/router.js\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_router__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../styles/globals.css */ \"./styles/globals.css\");\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_styles_globals_css__WEBPACK_IMPORTED_MODULE_3__);\n// pages/_app.tsx\n\n\n\n\nconst isBiz = (url)=>url.startsWith(\"/business\");\nfunction App({ Component, pageProps }) {\n    const router = (0,next_router__WEBPACK_IMPORTED_MODULE_1__.useRouter)();\n    const [showOverlay, setShowOverlay] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);\n    const [fadeIn, setFadeIn] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);\n    const [toBusiness, setToBusiness] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);\n    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(()=>{\n        const onStart = (url)=>{\n            if (isBiz(router.asPath) !== isBiz(url)) {\n                setToBusiness(isBiz(url));\n                setShowOverlay(true);\n                setFadeIn(false);\n                // Trigger fade-in on next frame\n                requestAnimationFrame(()=>requestAnimationFrame(()=>setFadeIn(true)));\n            }\n        };\n        const onDone = ()=>{\n            // Hold so user can read it, then fade out and unmount\n            setTimeout(()=>{\n                setFadeIn(false);\n                // Wait for fade-out to finish before unmounting\n                setTimeout(()=>setShowOverlay(false), 450);\n            }, 500);\n        };\n        const onError = ()=>setShowOverlay(false);\n        router.events.on(\"routeChangeStart\", onStart);\n        router.events.on(\"routeChangeComplete\", onDone);\n        router.events.on(\"routeChangeError\", onError);\n        return ()=>{\n            router.events.off(\"routeChangeStart\", onStart);\n            router.events.off(\"routeChangeComplete\", onDone);\n            router.events.off(\"routeChangeError\", onError);\n        };\n    }, [\n        router\n    ]);\n    const dark = toBusiness;\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, {\n        children: [\n            showOverlay && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                \"aria-hidden\": \"true\",\n                style: {\n                    position: \"fixed\",\n                    inset: 0,\n                    zIndex: 200,\n                    opacity: fadeIn ? 1 : 0,\n                    transition: \"opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)\",\n                    background: dark ? \"#0a0a0a\" : \"#ffffff\",\n                    display: \"flex\",\n                    alignItems: \"center\",\n                    justifyContent: \"center\"\n                },\n                children: [\n                    dark && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                        style: {\n                            position: \"absolute\",\n                            inset: 0,\n                            backgroundImage: \"linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)\",\n                            backgroundSize: \"48px 48px\"\n                        }\n                    }, void 0, false, {\n                        fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                        lineNumber: 66,\n                        columnNumber: 13\n                    }, this),\n                    !dark && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                        style: {\n                            position: \"absolute\",\n                            inset: 0,\n                            backgroundImage: \"linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)\",\n                            backgroundSize: \"48px 48px\"\n                        }\n                    }, void 0, false, {\n                        fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                        lineNumber: 75,\n                        columnNumber: 13\n                    }, this),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                        style: {\n                            position: \"absolute\",\n                            left: \"50%\",\n                            top: \"50%\",\n                            transform: \"translate(-50%,-50%)\",\n                            width: \"500px\",\n                            height: \"500px\",\n                            borderRadius: \"50%\",\n                            background: dark ? \"radial-gradient(ellipse, rgba(10,132,255,0.12) 0%, transparent 70%)\" : \"radial-gradient(ellipse, rgba(10,132,255,0.07) 0%, transparent 70%)\",\n                            pointerEvents: \"none\"\n                        }\n                    }, void 0, false, {\n                        fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                        lineNumber: 83,\n                        columnNumber: 11\n                    }, this),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                        style: {\n                            position: \"relative\",\n                            textAlign: \"center\"\n                        },\n                        children: [\n                            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"p\", {\n                                style: {\n                                    fontSize: \"1.75rem\",\n                                    fontWeight: 900,\n                                    color: dark ? \"#ffffff\" : \"#0a0a0a\",\n                                    letterSpacing: \"-0.03em\",\n                                    marginBottom: \"4px\"\n                                },\n                                children: \"ScheduleMe\"\n                            }, void 0, false, {\n                                fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                                lineNumber: 95,\n                                columnNumber: 13\n                            }, this),\n                            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"p\", {\n                                style: {\n                                    fontSize: \"10px\",\n                                    fontWeight: 700,\n                                    letterSpacing: \"0.2em\",\n                                    textTransform: \"uppercase\",\n                                    color: \"#0A84FF\"\n                                },\n                                children: toBusiness ? \"for Business\" : \"for Everyone\"\n                            }, void 0, false, {\n                                fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                                lineNumber: 102,\n                                columnNumber: 13\n                            }, this)\n                        ]\n                    }, void 0, true, {\n                        fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                        lineNumber: 94,\n                        columnNumber: 11\n                    }, this)\n                ]\n            }, void 0, true, {\n                fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                lineNumber: 54,\n                columnNumber: 9\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"/Users/joshua/Documents/GitHub/ScheduleMe/scheduleme/pages/_app.tsx\",\n                lineNumber: 113,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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O29DQUN2Q0gsT0FBTztnQ0FDVDswQ0FDR3JDLGFBQWEsaUJBQWlCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7MEJBTXZDLDhEQUFDUDtnQkFBVyxHQUFHQyxTQUFTOzs7Ozs7OztBQUc5QiIsInNvdXJjZXMiOlsid2VicGFjazovL3NjaGVkdWxlbWUvLi9wYWdlcy9fYXBwLnRzeD8yZmJlIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHBhZ2VzL19hcHAudHN4XG5pbXBvcnQgdHlwZSB7IEFwcFByb3BzIH0gZnJvbSAnbmV4dC9hcHAnO1xuaW1wb3J0IHsgdXNlUm91dGVyIH0gZnJvbSAnbmV4dC9yb3V0ZXInO1xuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCAnLi4vc3R5bGVzL2dsb2JhbHMuY3NzJztcblxuY29uc3QgaXNCaXogPSAodXJsOiBzdHJpbmcpID0+IHVybC5zdGFydHNXaXRoKCcvYnVzaW5lc3MnKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfTogQXBwUHJvcHMpIHtcbiAgY29uc3Qgcm91dGVyID0gdXNlUm91dGVyKCk7XG4gIGNvbnN0IFtzaG93T3ZlcmxheSwgc2V0U2hvd092ZXJsYXldID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbZmFkZUluLCBzZXRGYWRlSW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbdG9CdXNpbmVzcywgc2V0VG9CdXNpbmVzc10gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBvblN0YXJ0ID0gKHVybDogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoaXNCaXoocm91dGVyLmFzUGF0aCkgIT09IGlzQml6KHVybCkpIHtcbiAgICAgICAgc2V0VG9CdXNpbmVzcyhpc0Jpeih1cmwpKTtcbiAgICAgICAgc2V0U2hvd092ZXJsYXkodHJ1ZSk7XG4gICAgICAgIHNldEZhZGVJbihmYWxzZSk7XG4gICAgICAgIC8vIFRyaWdnZXIgZmFkZS1pbiBvbiBuZXh0IGZyYW1lXG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PlxuICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiBzZXRGYWRlSW4odHJ1ZSkpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IG9uRG9uZSA9ICgpID0+IHtcbiAgICAgIC8vIEhvbGQgc28gdXNlciBjYW4gcmVhZCBpdCwgdGhlbiBmYWRlIG91dCBhbmQgdW5tb3VudFxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHNldEZhZGVJbihmYWxzZSk7XG4gICAgICAgIC8vIFdhaXQgZm9yIGZhZGUtb3V0IHRvIGZpbmlzaCBiZWZvcmUgdW5tb3VudGluZ1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHNldFNob3dPdmVybGF5KGZhbHNlKSwgNDUwKTtcbiAgICAgIH0sIDUwMCk7XG4gICAgfTtcblxuICAgIGNvbnN0IG9uRXJyb3IgPSAoKSA9PiBzZXRTaG93T3ZlcmxheShmYWxzZSk7XG5cbiAgICByb3V0ZXIuZXZlbnRzLm9uKCdyb3V0ZUNoYW5nZVN0YXJ0Jywgb25TdGFydCk7XG4gICAgcm91dGVyLmV2ZW50cy5vbigncm91dGVDaGFuZ2VDb21wbGV0ZScsIG9uRG9uZSk7XG4gICAgcm91dGVyLmV2ZW50cy5vbigncm91dGVDaGFuZ2VFcnJvcicsIG9uRXJyb3IpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICByb3V0ZXIuZXZlbnRzLm9mZigncm91dGVDaGFuZ2VTdGFydCcsIG9uU3RhcnQpO1xuICAgICAgcm91dGVyLmV2ZW50cy5vZmYoJ3JvdXRlQ2hhbmdlQ29tcGxldGUnLCBvbkRvbmUpO1xuICAgICAgcm91dGVyLmV2ZW50cy5vZmYoJ3JvdXRlQ2hhbmdlRXJyb3InLCBvbkVycm9yKTtcbiAgICB9O1xuICB9LCBbcm91dGVyXSk7XG5cbiAgY29uc3QgZGFyayA9IHRvQnVzaW5lc3M7XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAge3Nob3dPdmVybGF5ICYmIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIGFyaWEtaGlkZGVuPVwidHJ1ZVwiXG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLCBpbnNldDogMCwgekluZGV4OiAyMDAsXG4gICAgICAgICAgICBvcGFjaXR5OiBmYWRlSW4gPyAxIDogMCxcbiAgICAgICAgICAgIHRyYW5zaXRpb246ICdvcGFjaXR5IDAuNHMgY3ViaWMtYmV6aWVyKDAuMTYsIDEsIDAuMywgMSknLFxuICAgICAgICAgICAgYmFja2dyb3VuZDogZGFyayA/ICcjMGEwYTBhJyA6ICcjZmZmZmZmJyxcbiAgICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgey8qIEdyaWQg4oCUIG9ubHkgb24gZGFyayAqL31cbiAgICAgICAgICB7ZGFyayAmJiAoXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLCBpbnNldDogMCxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZEltYWdlOiAnbGluZWFyLWdyYWRpZW50KHRvIHJpZ2h0LCByZ2JhKDI1NSwyNTUsMjU1LDAuMDI1KSAxcHgsIHRyYW5zcGFyZW50IDFweCksIGxpbmVhci1ncmFkaWVudCh0byBib3R0b20sIHJnYmEoMjU1LDI1NSwyNTUsMC4wMjUpIDFweCwgdHJhbnNwYXJlbnQgMXB4KScsXG4gICAgICAgICAgICAgIGJhY2tncm91bmRTaXplOiAnNDhweCA0OHB4JyxcbiAgICAgICAgICAgIH19IC8+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBHcmlkIOKAlCBsaWdodCB2ZXJzaW9uICovfVxuICAgICAgICAgIHshZGFyayAmJiAoXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLCBpbnNldDogMCxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZEltYWdlOiAnbGluZWFyLWdyYWRpZW50KHRvIHJpZ2h0LCByZ2JhKDAsMCwwLDAuMDQpIDFweCwgdHJhbnNwYXJlbnQgMXB4KSwgbGluZWFyLWdyYWRpZW50KHRvIGJvdHRvbSwgcmdiYSgwLDAsMCwwLjA0KSAxcHgsIHRyYW5zcGFyZW50IDFweCknLFxuICAgICAgICAgICAgICBiYWNrZ3JvdW5kU2l6ZTogJzQ4cHggNDhweCcsXG4gICAgICAgICAgICB9fSAvPlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICB7LyogR2xvdyAqL31cbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7XG4gICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJywgbGVmdDogJzUwJScsIHRvcDogJzUwJScsXG4gICAgICAgICAgICB0cmFuc2Zvcm06ICd0cmFuc2xhdGUoLTUwJSwtNTAlKScsXG4gICAgICAgICAgICB3aWR0aDogJzUwMHB4JywgaGVpZ2h0OiAnNTAwcHgnLCBib3JkZXJSYWRpdXM6ICc1MCUnLFxuICAgICAgICAgICAgYmFja2dyb3VuZDogZGFya1xuICAgICAgICAgICAgICA/ICdyYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSwgcmdiYSgxMCwxMzIsMjU1LDAuMTIpIDAlLCB0cmFuc3BhcmVudCA3MCUpJ1xuICAgICAgICAgICAgICA6ICdyYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSwgcmdiYSgxMCwxMzIsMjU1LDAuMDcpIDAlLCB0cmFuc3BhcmVudCA3MCUpJyxcbiAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6ICdub25lJyxcbiAgICAgICAgICB9fSAvPlxuXG4gICAgICAgICAgey8qIEJyYW5kIHRleHQgKi99XG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBwb3NpdGlvbjogJ3JlbGF0aXZlJywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICAgIDxwIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGZvbnRTaXplOiAnMS43NXJlbScsIGZvbnRXZWlnaHQ6IDkwMCxcbiAgICAgICAgICAgICAgY29sb3I6IGRhcmsgPyAnI2ZmZmZmZicgOiAnIzBhMGEwYScsXG4gICAgICAgICAgICAgIGxldHRlclNwYWNpbmc6ICctMC4wM2VtJywgbWFyZ2luQm90dG9tOiAnNHB4JyxcbiAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICBTY2hlZHVsZU1lXG4gICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8cCBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250U2l6ZTogJzEwcHgnLCBmb250V2VpZ2h0OiA3MDAsXG4gICAgICAgICAgICAgIGxldHRlclNwYWNpbmc6ICcwLjJlbScsIHRleHRUcmFuc2Zvcm06ICd1cHBlcmNhc2UnLFxuICAgICAgICAgICAgICBjb2xvcjogJyMwQTg0RkYnLFxuICAgICAgICAgICAgfX0+XG4gICAgICAgICAgICAgIHt0b0J1c2luZXNzID8gJ2ZvciBCdXNpbmVzcycgOiAnZm9yIEV2ZXJ5b25lJ31cbiAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+XG4gICAgPC8+XG4gICk7XG59XG4iXSwibmFtZXMiOlsidXNlUm91dGVyIiwidXNlRWZmZWN0IiwidXNlU3RhdGUiLCJpc0JpeiIsInVybCIsInN0YXJ0c1dpdGgiLCJBcHAiLCJDb21wb25lbnQiLCJwYWdlUHJvcHMiLCJyb3V0ZXIiLCJzaG93T3ZlcmxheSIsInNldFNob3dPdmVybGF5IiwiZmFkZUluIiwic2V0RmFkZUluIiwidG9CdXNpbmVzcyIsInNldFRvQnVzaW5lc3MiLCJvblN0YXJ0IiwiYXNQYXRoIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwib25Eb25lIiwic2V0VGltZW91dCIsIm9uRXJyb3IiLCJldmVudHMiLCJvbiIsIm9mZiIsImRhcmsiLCJkaXYiLCJhcmlhLWhpZGRlbiIsInN0eWxlIiwicG9zaXRpb24iLCJpbnNldCIsInpJbmRleCIsIm9wYWNpdHkiLCJ0cmFuc2l0aW9uIiwiYmFja2dyb3VuZCIsImRpc3BsYXkiLCJhbGlnbkl0ZW1zIiwianVzdGlmeUNvbnRlbnQiLCJiYWNrZ3JvdW5kSW1hZ2UiLCJiYWNrZ3JvdW5kU2l6ZSIsImxlZnQiLCJ0b3AiLCJ0cmFuc2Zvcm0iLCJ3aWR0aCIsImhlaWdodCIsImJvcmRlclJhZGl1cyIsInBvaW50ZXJFdmVudHMiLCJ0ZXh0QWxpZ24iLCJwIiwiZm9udFNpemUiLCJmb250V2VpZ2h0IiwiY29sb3IiLCJsZXR0ZXJTcGFjaW5nIiwibWFyZ2luQm90dG9tIiwidGV4dFRyYW5zZm9ybSJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./pages/_app.tsx\n");

/***/ }),

/***/ "./styles/globals.css":
/*!****************************!*\
  !*** ./styles/globals.css ***!
  \****************************/
/***/ (() => {



/***/ }),

/***/ "next/dist/compiled/next-server/pages.runtime.dev.js":
/*!**********************************************************************!*\
  !*** external "next/dist/compiled/next-server/pages.runtime.dev.js" ***!
  \**********************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/pages.runtime.dev.js");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("react");

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = require("react-dom");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "react/jsx-runtime":
/*!************************************!*\
  !*** external "react/jsx-runtime" ***!
  \************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-runtime");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("zlib");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@swc"], () => (__webpack_exec__("./pages/_app.tsx")));
module.exports = __webpack_exports__;

})();