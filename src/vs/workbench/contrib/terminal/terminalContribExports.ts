/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IConfigurationNode } from '../../../platform/configuration/common/configurationRegistry.js';
import { TerminalAccessibilityCommandId, defaultTerminalAccessibilityCommandsToSkipShell } from '../terminalContrib/accessibility/common/terminal.accessibility.js';
import { terminalAccessibilityConfiguration } from '../terminalContrib/accessibility/common/terminalAccessibilityConfiguration.js';
import { terminalAutoRepliesConfiguration } from '../terminalContrib/autoReplies/common/terminalAutoRepliesConfiguration.js';

import { terminalCommandGuideConfiguration } from '../terminalContrib/commandGuide/common/terminalCommandGuideConfiguration.js';
import { TerminalDeveloperCommandId } from '../terminalContrib/developer/common/terminal.developer.js';
import { defaultTerminalFindCommandToSkipShell } from '../terminalContrib/find/common/terminal.find.js';
import { defaultTerminalHistoryCommandsToSkipShell, terminalHistoryConfiguration } from '../terminalContrib/history/common/terminal.history.js';
import { TerminalStickyScrollSettingId, terminalStickyScrollConfiguration } from '../terminalContrib/stickyScroll/common/terminalStickyScrollConfiguration.js';
import { defaultTerminalSuggestCommandsToSkipShell } from '../terminalContrib/suggest/common/terminal.suggest.js';
import { TerminalSuggestSettingId, terminalSuggestConfiguration } from '../terminalContrib/suggest/common/terminalSuggestConfiguration.js';
import { terminalTypeAheadConfiguration } from '../terminalContrib/typeAhead/common/terminalTypeAheadConfiguration.js';
import { terminalZoomConfiguration } from '../terminalContrib/zoom/common/terminal.zoom.js';

export const enum TerminalContribCommandId {
	A11yFocusAccessibleBuffer = TerminalAccessibilityCommandId.FocusAccessibleBuffer,
	DeveloperRestartPtyHost = TerminalDeveloperCommandId.RestartPtyHost,
}

export const enum TerminalContribSettingId {
	StickyScrollEnabled = TerminalStickyScrollSettingId.Enabled,
	SuggestEnabled = TerminalSuggestSettingId.Enabled,
}

export const terminalContribConfiguration: IConfigurationNode['properties'] = {
	...terminalAccessibilityConfiguration,
	...terminalAutoRepliesConfiguration,
	// ...terminalInitialHintConfiguration,
	...terminalCommandGuideConfiguration,
	...terminalHistoryConfiguration,
	...terminalStickyScrollConfiguration,
	...terminalSuggestConfiguration,
	...terminalTypeAheadConfiguration,
	...terminalZoomConfiguration,
};

export const defaultTerminalContribCommandsToSkipShell = [
	...defaultTerminalAccessibilityCommandsToSkipShell,
	...defaultTerminalFindCommandToSkipShell,
	...defaultTerminalHistoryCommandsToSkipShell,
	...defaultTerminalSuggestCommandsToSkipShell,
];
