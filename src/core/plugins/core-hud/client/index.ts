import * as alt from 'alt-client';
import * as native from 'natives';
import { HUD_COMPONENT } from '@AthenaShared/enums/hudComponents';
import { SYSTEM_EVENTS } from '@AthenaShared/enums/system';
import { VEHICLE_STATE } from '@AthenaShared/enums/vehicle';
import IClientInteraction from '@AthenaShared/interfaces/iClientInteraction';
import IHudComponent from '@AthenaShared/interfaces/iHudComponent';
import { PLAYER_SYNCED_META } from '@AthenaShared/enums/playerSynced';
import { WebViewController } from '@AthenaClient/extensions/view2';
import ViewModel from '@AthenaClient/models/viewModel';
import { InteractionController } from '@AthenaClient/systems/interaction';
import { World } from '@AthenaClient/systems/world';
import { AthenaClient } from '@AthenaClient/api/athena';
import { KeybindController } from '@AthenaClient/events/keyup';
import { isAnyMenuOpen } from '@AthenaClient/utility/menus';
import { KeyHeld } from '@AthenaClient/events/keyHeld';
import { VehicleData } from '../../../shared/information/vehicles';
import { isVehicleType, VEHICLE_TYPE } from '../../../shared/enums/vehicleTypeFlags';
import { SHARED_CONFIG } from '@AthenaShared/configurations/shared';

const SWITCH_KEY = 113; // F2
const PAGE_NAME = 'Hud';
const RegisteredComponents: { [key: string]: IHudComponent } = {};

let interval;
let isDisabled = false;
let interactions: Array<IClientInteraction> = [];
let customInteractions: Array<IClientInteraction> = [];
let hasRegistered = false;
let hudStateIndex = 0;
let hudStates = ['hud', 'wallet', 'hidden'];

export class HudView {
    static init() {
        InteractionController.addInfoCallback(HudView.setInteractions);
        KeybindController.registerKeybind({ key: SWITCH_KEY, singlePress: HudView.toggleKeyBind });
    }

    private static toggleKeyBind() {
        if (isAnyMenuOpen()) {
            return;
        }

        hudStateIndex += 1;
        if (hudStateIndex >= hudStates.length) {
            hudStateIndex = 0;
        }

        native.playSoundFrontend(-1, 'HIGHLIGHT_NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true);
        AthenaClient.webview.emit(`${PAGE_NAME}:SwitchHudState`, hudStates[hudStateIndex]);
    }

    static addCustomInteraction(_interaction: IClientInteraction) {
        const index = customInteractions.findIndex((x) => x.uid === _interaction.uid);
        if (index >= 0) {
            customInteractions[index] = {
                uid: _interaction.uid,
                ..._interaction,
            };
        } else {
            customInteractions.push({
                uid: _interaction.uid,
                ..._interaction,
            });
        }
    }

    static removeCustomInteraction(uid: string) {
        const index = customInteractions.findIndex((x) => x.uid === uid);
        if (index <= -1) {
            return;
        }

        customInteractions.splice(index, 1);
    }

    static async setInteractions(_interactions: Array<IClientInteraction>) {
        interactions = _interactions;
    }

    /**
     * Register a component for the HUD.
     * You should pass the data inside the callback with:
     * 'HudView.passComponentInfo()'
     * @static
     * @param {number} [msBetweenUpdates=1000]
     * @param {(propName: string) => void, msBetweenUpdates: number = 1000} callback
     * @memberof HudView
     */
    static registerComponent(uid: string, callback: (propName: string) => void, msBetweenUpdates: number = 1000) {
        RegisteredComponents[uid] = {
            callback,
            msBetweenUpdates,
            lastUpdate: Date.now(),
        };
    }
}

/**
 * Do Not Export Internal Only
 */
class InternalFunctions implements ViewModel {
    static async open() {
        if (!hasRegistered) {
            WebViewController.registerOverlay(PAGE_NAME, InternalFunctions.setVisible);
            WebViewController.ready(PAGE_NAME, InternalFunctions.ready);
        }
    }

    static metaChange(key: string, value: any) {
        if (key === 'voice' && alt.Voice.voiceControlsEnabled && alt.Player.local.meta.voice) {
            InternalFunctions.passComponentInfo(HUD_COMPONENT.MICROPHONE, false);
            KeyHeld.register(alt.Voice.activationKey, InternalFunctions.voiceDown, InternalFunctions.voiceUp);
        }
    }

    static async setVisible(value: boolean) {
        isDisabled = !value;

        if (!isDisabled) {
            native.displayRadar(true);
            native.playSoundFrontend(-1, 'HIGHLIGHT_NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true);
            AthenaClient.webview.emit(`${PAGE_NAME}:SwitchHudState`, hudStates[hudStateIndex]);
            return;
        }

        native.displayRadar(false);
    }

    static async ready() {
        if (interval) {
            alt.clearInterval(interval);
        }

        // Standard Walking Components
        HudView.registerComponent(HUD_COMPONENT.HEALTH, InternalFunctions.defaultHealthComponent, 50);
        HudView.registerComponent(HUD_COMPONENT.ARMOUR, InternalFunctions.defaultArmourComponent, 50);
        HudView.registerComponent(HUD_COMPONENT.CASH, InternalFunctions.defaultCashComponent, 1000);
        HudView.registerComponent(HUD_COMPONENT.BANK, InternalFunctions.defaultBankComponent, 1000);
        HudView.registerComponent(HUD_COMPONENT.TIME, InternalFunctions.defaultTimeComponent, 5000);
        HudView.registerComponent(HUD_COMPONENT.WATER, InternalFunctions.defaultWaterComponent, 1000);
        HudView.registerComponent(HUD_COMPONENT.FOOD, InternalFunctions.defaultFoodComponent, 1000);
        HudView.registerComponent(HUD_COMPONENT.INTERACTIONS, InternalFunctions.defaultInteractionsComponent, 500);
        HudView.registerComponent(HUD_COMPONENT.DEAD, InternalFunctions.defaultDeadComponent, 500);
        HudView.registerComponent(HUD_COMPONENT.IDENTIFIER, InternalFunctions.defaultIdentifier, 5000);
        HudView.registerComponent(HUD_COMPONENT.MICROPHONE, InternalFunctions.defaultMicrophoneComponent, 100);

        // Vehicle Components
        HudView.registerComponent(HUD_COMPONENT.IS_IN_VEHICLE, InternalFunctions.defaultIsInVehicleComponent, 1000);
        HudView.registerComponent(HUD_COMPONENT.SEATBELT, InternalFunctions.defaultSeatbeltComponent, 100);
        HudView.registerComponent(HUD_COMPONENT.SPEED, InternalFunctions.defaultSpeedComponent, 100);
        HudView.registerComponent(HUD_COMPONENT.SPEED_UNIT, InternalFunctions.defaultSpeedUnitComponente);
        HudView.registerComponent(HUD_COMPONENT.GEAR, InternalFunctions.defaultGearComponent, 100);
        HudView.registerComponent(HUD_COMPONENT.ENGINE, InternalFunctions.defaultEngineComponent, 100);
        HudView.registerComponent(HUD_COMPONENT.LOCK, InternalFunctions.defaultLockComponent, 100);
        HudView.registerComponent(HUD_COMPONENT.METRIC, InternalFunctions.defaultMetricComponent, 2500);
        HudView.registerComponent(HUD_COMPONENT.FUEL, InternalFunctions.defaultFuelComponent, 100);

        interval = alt.setInterval(InternalFunctions.renderComponents, 0);
    }

    static renderComponents() {
        alt.beginScaleformMovieMethodMinimap('SETUP_HEALTH_ARMOUR');
        native.scaleformMovieMethodAddParamInt(3);
        native.endScaleformMovieMethod();

        if (isDisabled) {
            return;
        }

        Object.keys(RegisteredComponents).forEach((key) => {
            const component = RegisteredComponents[key];

            if (Date.now() <= component.lastUpdate) {
                return;
            }

            RegisteredComponents[key].lastUpdate = Date.now() + RegisteredComponents[key].msBetweenUpdates;
            RegisteredComponents[key].callback(key);
        });
    }

    static async passComponentInfo(propName: string, value: any, isJSON = false) {
        AthenaClient.webview.emit(`${PAGE_NAME}:SetProp`, propName, value, isJSON);
    }

    /**
     * Remove a component to render on the HUD.
     * It simply stops it from pushing data the CEF but does not stop it from drawing.
     * @static
     * @param {string} uid
     * @memberof HudView
     */
    static unregisterComponent(uid: string) {
        isDisabled = true;

        if (RegisteredComponents[uid]) {
            delete RegisteredComponents[uid];
        }

        isDisabled = false;
    }

    static defaultTimeComponent() {
        InternalFunctions.passComponentInfo('time', World.getTimeAsString());
    }

    static defaultFuelComponent(propName: string) {
        if (!alt.Player.local.vehicle) {
            return;
        }

        let fuel = 100;

        if (alt.Player.local.vehicle.hasSyncedMeta(VEHICLE_STATE.FUEL)) {
            fuel = alt.Player.local.vehicle.getSyncedMeta(VEHICLE_STATE.FUEL) as number;
        }

        InternalFunctions.passComponentInfo(propName, parseInt(fuel.toFixed(0)));
    }

    static defaultSeatbeltComponent(propName: string) {
        if (!alt.Player.local.vehicle) return;

        InternalFunctions.passComponentInfo(propName, alt.Player.local.getMeta('SEATBELT') ? true : false);
    }

    static defaultSpeedComponent(propName: string) {
        if (!alt.Player.local.vehicle) {
            return;
        }

        const isMetric = native.getProfileSetting(227);
        const currentSpeed = native.getEntitySpeed(alt.Player.local.vehicle.scriptID);

        let speedCalc: string;

        const data = VehicleData.find((dat) => alt.hash(dat.name) === alt.Player.local.vehicle.model);

        if (
            SHARED_CONFIG.ENABLE_KNOTS_FOR_BOATS_AND_AIRCRAFT &&
            (isVehicleType(data.type, VEHICLE_TYPE.AIRCRAFT) || isVehicleType(data.type, VEHICLE_TYPE.BOAT))
        ) {
            speedCalc = (currentSpeed * 1.943844).toFixed(0);
        } else {
            speedCalc = (currentSpeed * (isMetric ? 3.6 : 2.236936)).toFixed(0);
        }

        InternalFunctions.passComponentInfo(propName, parseInt(speedCalc));
    }

    static defaultMetricComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, native.getProfileSetting(227) === 1);
    }

    static defaultSpeedUnitComponente(propName: string) {
        const data = VehicleData.find((dat) => alt.hash(dat.name) === alt.Player.local.vehicle.model);
        if (!data) {
            return;
        }

        let unit: string;

        if (
            SHARED_CONFIG.ENABLE_KNOTS_FOR_BOATS_AND_AIRCRAFT &&
            (isVehicleType(data.type, VEHICLE_TYPE.AIRCRAFT) || isVehicleType(data.type, VEHICLE_TYPE.BOAT))
        ) {
            unit = 'kn';
        } else {
            if (native.getProfileSetting(227) === 1) {
                unit = 'KM/H';
            } else {
                unit = 'MPH';
            }
        }

        InternalFunctions.passComponentInfo(propName, unit);
    }

    static defaultIsInVehicleComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, alt.Player.local.vehicle ? true : false);
    }

    static defaultWaterComponent(propName: string) {
        const water = alt.Player.local.meta.water;
        InternalFunctions.passComponentInfo(
            propName,
            water !== undefined && water !== null ? parseInt(water.toFixed(0)) : 100,
        );
    }

    static defaultFoodComponent(propName: string) {
        const food = alt.Player.local.meta.food;
        InternalFunctions.passComponentInfo(
            propName,
            food !== undefined && food !== null ? parseInt(food.toFixed(0)) : 100,
        );
    }

    static defaultDeadComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, alt.Player.local.meta.isDead ? true : false);
    }

    static defaultCashComponent(propName: string) {
        const value = alt.Player.local.meta.cash ? alt.Player.local.meta.cash : 0;
        const fixedValue = parseFloat(value.toFixed(0));
        InternalFunctions.passComponentInfo(propName, fixedValue);
    }

    static defaultBankComponent(propName: string) {
        const value = alt.Player.local.meta.bank ? alt.Player.local.meta.bank : 0;
        const fixedValue = parseFloat(value.toFixed(0));
        InternalFunctions.passComponentInfo(propName, fixedValue);
    }

    static defaultGearComponent(propName: string) {
        if (!alt.Player.local.vehicle) {
            return;
        }

        InternalFunctions.passComponentInfo(propName, alt.Player.local.vehicle.gear);
    }

    static defaultEngineComponent(propName: string) {
        if (!alt.Player.local.vehicle) {
            return;
        }

        const isEngineOn = native.getIsVehicleEngineRunning(alt.Player.local.vehicle.scriptID);
        InternalFunctions.passComponentInfo(propName, isEngineOn);
    }

    static defaultLockComponent(propName: string) {
        if (!alt.Player.local.vehicle) {
            return;
        }

        const lockStatus = native.getVehicleDoorLockStatus(alt.Player.local.vehicle.scriptID) === 2;
        InternalFunctions.passComponentInfo(propName, lockStatus);
    }

    static defaultHealthComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, alt.Player.local.health - 1);
    }

    static defaultArmourComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, alt.Player.local.armour);
    }

    static defaultInteractionsComponent(propName: string) {
        InternalFunctions.passComponentInfo(propName, JSON.stringify(interactions.concat(customInteractions)), true);
    }

    static defaultMicrophoneComponent(propName: string) {
        let microphoneVolume = alt.Player.local.getMeta('MICROPHONE_VOLUME');
        InternalFunctions.passComponentInfo(propName, microphoneVolume ? microphoneVolume : 0);
    }

    static voiceDown(newVolume: number = 0) {
        native.playSoundFrontend(-1, 'Input_Code_Down', 'Safe_Minigame_Sounds', true);
        InternalFunctions.voiceVolume(newVolume);
    }

    static voiceUp(newVolume: number = 100) {
        native.playSoundFrontend(-1, 'Input_Code_Up', 'Safe_Minigame_Sounds', true);
        InternalFunctions.voiceVolume(newVolume);
    }

    static voiceVolume(newVolume: number = 100) {
        InternalFunctions.passComponentInfo(HUD_COMPONENT.MICROPHONE, newVolume);
    }

    static defaultIdentifier(propName: string) {
        InternalFunctions.passComponentInfo(
            propName,
            alt.Player.local.getSyncedMeta(PLAYER_SYNCED_META.IDENTIFICATION_ID),
        );
    }
}

alt.on('localMetaChange', InternalFunctions.metaChange);
alt.onceServer(SYSTEM_EVENTS.TICKS_START, InternalFunctions.open);
alt.onServer(SYSTEM_EVENTS.INTERACTION_TEXT_CREATE, HudView.addCustomInteraction);
alt.onServer(SYSTEM_EVENTS.INTERACTION_TEXT_REMOVE, HudView.removeCustomInteraction);

HudView.init();
