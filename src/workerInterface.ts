/**
 * Interface for communicating back and forth with worker processes.
 */
 
module Bkgdr {
    "use strict";
    
    export class WorkerInterface {
        
        public useWorker: boolean;
        private context: any;
        private callbacks: WorkerCallback[] = [];
        private static instance : WorkerInterface;
        
        public static getInstance(): WorkerInterface {
            return WorkerInterface.instance;
        }
        
        private init(useWorker: boolean, workerPath?: string) {
            this.useWorker = useWorker;
            WorkerInterface.instance = this;
            if (useWorker) {
                this.context = this.setupWorker(workerPath);
                this.registerMessageHandleForContext(this.context);
            }
        }
        
        private registerMessageHandleForContext(context) {
            if (context) {
                context.onmessage = (msg) =>  this.handleRequests(msg);
                if (context.onerror === null) {
                    context.onerror = (msg) => Statics.log(msg);
                }
            }
        }  
        
        private setupWorker(workerPath?: string): any {
            if (!Statics.inWorker) {
                var loadPath = workerPath || this.getScriptSrcPath();
                if (loadPath) {
                    return new Worker(loadPath);
                }
            }
            return self;
        }
        
        private getScriptSrcPath(): string {
          var scripts = document.getElementsByTagName("script");
          for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src && scripts[i].src.indexOf("bkgdr") !== -1) {
              return scripts[i].src;
            }
          }
          return null;
        }

        private sendMessage(message) {
            if (this.useWorker) {
                this.context.postMessage(message);
            } else {
                // short timeout both to emulate a worker call async and to allow the callback to be wired up.
                setTimeout(() => {
                    this.handleRequests({data:message});
                    
                }, 1);
            }
        }

        private handleRequests(message) {
            var obj = message.data;
            if (obj.loadScript) {
                this.addScript(obj.loadScript);
            } else if (obj.func) {
                this.processFunction(obj.func);
            } else if (obj.callback) {
                this.handleReturnData(obj.callback);
            }
        }

        private handleReturnData(returnData) {
            var foundIndex = -1
            this.callbacks.forEach(function(data, index) {
                if (data.func.id === returnData.id) {
                    foundIndex = index;
                }
            });

            if (foundIndex !== -1) {
                var callback = this.callbacks.splice(foundIndex, 1);
                callback[0].deferred.resolve(returnData.returnValue);
            }
        }

        public execute(functionName: string, params: any[]) {
            var func: FunctionDefinition = new FunctionDefinition(functionName, params, "-1");
            var data: any = {func: func};
            this.sendMessage(data);
        }

        public executeWithPromise(functionName: string, params: any[]) {
            var func: FunctionDefinition = new FunctionDefinition(functionName, params);
            var data: any = {func: func};
            this.sendMessage(data);
            data.deferred = this.getDeferred();
            this.callbacks.push(data);
            return data.deferred.promise;
        }

        private processFunction (func: FunctionDefinition) {
            var returnData: ReturnData = {
                callback: {
                    id: func.id
                }
            };
            func = new FunctionDefinition(func.functionName, func.params, func.id);
            var returnVal = func.invoke();
            // callback to interface not defined
            if (func.id === "-1") {
                return;
            }
            
            //  probably a promise, but there are no guarantees.
            if (returnVal && returnVal.then && typeof returnVal.then === "function") {
                returnVal.then((resolved) => {
                    returnData.callback.returnValue = resolved;
                    this.sendMessage(returnData);
                });
            } else {
                returnData.callback.returnValue = returnVal;
                this.sendMessage(returnData);
            }
        }

        private getDeferred(): any {
            var deferred: Deferred = <Deferred> {};
            deferred.promise = new Promise(function(resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
            return deferred;
        }

        /**
         * Calls the native importScripts function on the worker context.
         * @param {string} scriptLocation
         */
        public addScript(scriptLocation): Promise<boolean> {
            if (this.useWorker && !Statics.inWorker) {
                return this.executeWithPromise("Bkgdr.wi.addScript", [scriptLocation]);
            } else if (Statics.inWorker) {
                importScripts(scriptLocation);
                return Promise.resolve(true);
            }
        }
    }
    
    interface WorkerCallback {
        deferred: Deferred;
        func: FunctionDefinition;
    }
    
    interface Deferred {
        promise: Promise<{}>;
        resolve: (value: any) => void;
        reject: (value: any) => void;
    }
    
    interface ReturnData {
        callback: Callback;
    }
    
    interface Callback {
        id: string;
        returnValue?: any;
    }
    
}