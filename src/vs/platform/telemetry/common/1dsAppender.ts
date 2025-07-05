/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IExtendedConfiguration, IExtendedTelemetryItem, ITelemetryItem, ITelemetryUnloadState } from '@microsoft/1ds-core-js';
import type { IChannelConfiguration, IXHROverride, PostChannel } from '@microsoft/1ds-post-js';
import { importAMDNodeModule } from '../../../amdX.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { mixin } from '../../../base/common/objects.js';
import { isWeb } from '../../../base/common/platform.js';
import { ITelemetryAppender, validateTelemetryData } from './telemetryUtils.js';



export interface IAppInsightsCore {
	pluginVersionString: string;
	track(item: ITelemetryItem | IExtendedTelemetryItem): void;
	unload(isAsync: boolean, unloadComplete: (unloadState: ITelemetryUnloadState) => void): void;
}




const endpointUrl = '0.0.0.0';
const endpointHealthUrl = '0.0.0.0';
async function getClient(instrumentationKey: string, addInternalFlag?: boolean, xhrOverride?: IXHROverride): Promise<IAppInsightsCore> {
	
	const oneDs = isWeb ? await importAMDNodeModule<typeof import('@microsoft/1ds-core-js')>('@microsoft/1ds-core-js', 'bundle/ms.core.min.js') : await import('@microsoft/1ds-core-js');
	
	const postPlugin = isWeb ? await importAMDNodeModule<typeof import('@microsoft/1ds-post-js')>('@microsoft/1ds-post-js', 'bundle/ms.post.min.js') : await import('@microsoft/1ds-post-js');

	const appInsightsCore = new oneDs.AppInsightsCore();
	const collectorChannelPlugin: PostChannel = new postPlugin.PostChannel();
	
	const coreConfig: IExtendedConfiguration = {
		instrumentationKey,
		endpointUrl,
		loggingLevelTelemetry: 0,
		loggingLevelConsole: 0,
		disableCookiesUsage: true,
		disableDbgExt: true,
		disableInstrumentationKeyValidation: true,
		channels: [[
			collectorChannelPlugin
		]]
	};

	if (xhrOverride) {
		coreConfig.extensionConfig = {};
		
		const channelConfig: IChannelConfiguration = {
			alwaysUseXhrOverride: true,
			ignoreMc1Ms0CookieProcessing: true,
			httpXHROverride: xhrOverride
		};
		coreConfig.extensionConfig[collectorChannelPlugin.identifier] = channelConfig;
	}

	appInsightsCore.initialize(coreConfig, []);

	appInsightsCore.addTelemetryInitializer((envelope: any) => {
		
		envelope['ext'] = envelope['ext'] ?? {};
		envelope['ext']['web'] = envelope['ext']['web'] ?? {};
		envelope['ext']['web']['consentDetails'] = '{"GPC_DataSharingOptIn":false}';

		if (addInternalFlag) {
			envelope['ext']['utc'] = envelope['ext']['utc'] ?? {};
			
			envelope['ext']['utc']['flags'] = 0x0000811ECD;
		}
	});

	return appInsightsCore;
}


export abstract class AbstractOneDataSystemAppender implements ITelemetryAppender {

	protected _aiCoreOrKey: IAppInsightsCore | string | undefined;
	private _asyncAiCore: Promise<IAppInsightsCore> | null;
	protected readonly endPointUrl = endpointUrl;
	protected readonly endPointHealthUrl = endpointHealthUrl;

	constructor(
		private readonly _isInternalTelemetry: boolean,
		private _eventPrefix: string,
		private _defaultData: { [key: string]: any } | null,
		iKeyOrClientFactory: string | (() => IAppInsightsCore), 
		private _xhrOverride?: IXHROverride
	) {
		if (!this._defaultData) {
			this._defaultData = {};
		}

		if (typeof iKeyOrClientFactory === 'function') {
			this._aiCoreOrKey = iKeyOrClientFactory();
		} else {
			this._aiCoreOrKey = iKeyOrClientFactory;
		}
		this._asyncAiCore = null;
	}

	private _withAIClient(callback: (aiCore: IAppInsightsCore) => void): void {
		if (!this._aiCoreOrKey) {
			return;
		}

		if (typeof this._aiCoreOrKey !== 'string') {
			callback(this._aiCoreOrKey);
			return;
		}

		if (!this._asyncAiCore) {
			this._asyncAiCore = getClient(this._aiCoreOrKey, this._isInternalTelemetry, this._xhrOverride);
		}

		this._asyncAiCore.then(
			(aiClient) => {
				callback(aiClient);
			},
			(err) => {
				onUnexpectedError(err);
				console.error(err);
			}
		);
	}

	log(eventName: string, data?: any): void {
		if (!this._aiCoreOrKey) {
			return;
		}
		data = mixin(data, this._defaultData);
		data = validateTelemetryData(data);
		const name = this._eventPrefix + '/' + eventName;

		try {
			this._withAIClient((aiClient) => {
				aiClient.pluginVersionString = data?.properties.version ?? 'Unknown';
				aiClient.track({
					name,
					baseData: { name, properties: data?.properties, measurements: data?.measurements }
				});
			});
		} catch { }
	}

	flush(): Promise<void> {
		if (this._aiCoreOrKey) {
			return new Promise(resolve => {
				this._withAIClient((aiClient) => {
					aiClient.unload(true, () => {
						this._aiCoreOrKey = undefined;
						resolve(undefined);
					});
				});
			});
		}
		return Promise.resolve(undefined);
	}
}
