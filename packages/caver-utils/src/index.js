/*
 Modifications copyright 2018 The caver-js Authors
 This file is part of web3.js.

 web3.js is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 web3.js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with web3.js.  If not, see <http://www.gnu.org/licenses/>.

 This file is derived from web3.js/packages/web3-utils/src/index.js (2019/06/12).
 Modified and improved for the caver-js development.
 */
/**
 * @file utils.js
 * @author Marek Kotewicz <marek@parity.io>
 * @author Fabian Vogelsteller <fabian@ethereum.org>
 * @date 2017
 */

const _ = require('underscore')
const ethjsUnit = require('ethjs-unit')
const utils = require('./utils.js')
const soliditySha3 = require('./soliditySha3.js')
const randomHex = require('../randomhex')
const promiEvent = require('../promievent')
const Iban = require('../iban')

/**
 * Fires an error in an event emitter and callback and returns the eventemitter
 *
 * @method _fireError
 * @param {Object} error a string, a error, or an object with {message, data}
 * @param {Object} emitter
 * @param {Function} reject
 * @param {Function} callback
 * @return {Object} the emitter
 */
var _fireError = function (error, emitter, reject, callback) {
    // add data if given
    if(_.isObject(error) && !(error instanceof Error) &&  error.data) {
        if(_.isObject(error.data) || _.isArray(error.data)) {
            error.data = JSON.stringify(error.data, null, 2)
        }

        error = error.message +"\n"+ error.data;
    }

    if(_.isString(error)) {
        error = new Error(error);
    }

    if (_.isFunction(callback)) {
        callback(error);
    }
    if (_.isFunction(reject)) {
        // suppress uncatched error if an error listener is present
        // OR suppress uncatched error if an callback listener is present
        if (emitter &&
            (_.isFunction(emitter.listeners) &&
            emitter.listeners('error').length) || _.isFunction(callback)) {
            emitter.catch(function(){});
        }
        // reject later, to be able to return emitter
        setTimeout(function () {
            reject(error);
        }, 1);
    }

    if(emitter && _.isFunction(emitter.emit)) {
        // emit later, to be able to return emitter
        setTimeout(function () {
            emitter.emit('error', error);
            emitter.removeAllListeners();
        }, 1);
    }

    return emitter;
};

/**
 * Should be used to create full function/event name from json abi
 *
 * @method _jsonInterfaceMethodToString
 * @param {Object} json
 * @return {String} full function/event name
 */
var _jsonInterfaceMethodToString = function (json) {
    if (_.isObject(json) && json.name && json.name.indexOf('(') !== -1) {
        return json.name;
    }

    var typeName = json.inputs.map(function(i){return i.type; }).join(',');
    return json.name + '(' + _flattenTypes(false, json.inputs).join(',') + ')'
};



/**
 * Should be called to get ascii from it's hex representation
 *
 * @method hexToAscii
 * @param {String} hex
 * @returns {String} ascii string representation of hex value
 */
var hexToAscii = function(hex) {
    if (!utils.isHexStrict(hex))
        throw new Error('The parameter must be a valid HEX string.');

    var str = "";
    var i = 0, l = hex.length;
    if (hex.substring(0, 2) === '0x') {
        i = 2;
    }
    for (; i < l; i+=2) {
        var code = parseInt(hex.substr(i, 2), 16);
        str += String.fromCharCode(code);
    }

    return str;
};

/**
 * Should be called to get hex representation (prefixed by 0x) of ascii string
 *
 * @method asciiToHex
 * @param {String} str
 * @returns {String} hex representation of input string
 */
var asciiToHex = function(str) {
    if(!str)
        return "0x00";
    var hex = "";
    for(var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        var n = code.toString(16);
        hex += n.length < 2 ? '0' + n : n;
    }

    return "0x" + hex;
};



/**
 * Returns value of unit in Wei
 *
 * @method getUnitValue
 * @param {String} unit the unit to convert to, default ether
 * @returns {BN} value of the unit (in Wei)
 * @throws error if the unit is not correct:w
 */
var getUnitValue = function (unit) {
    unit = unit ? unit.toLowerCase() : 'ether';
    if (!ethjsUnit.unitMap[unit]) {
        throw new Error('This unit "'+ unit +'" doesn\'t exist, please use the one of the following units' + JSON.stringify(ethjsUnit.unitMap, null, 2));
    }
    return unit;
};

/**
 * Takes a number of wei and converts it to any other ether unit.
 *
 * Possible units are:
 *   SI Short   SI Full        Effigy       Other
 * - kwei       femtoether     babbage
 * - mwei       picoether      lovelace
 * - gwei       nanoether      shannon      nano
 * - --         microether     szabo        micro
 * - --         milliether     finney       milli
 * - ether      --             --
 * - kether                    --           grand
 * - mether
 * - gether
 * - tether
 *
 * @method fromWei
 * @param {Number|String} number can be a number, number string or a HEX of a decimal
 * @param {String} unit the unit to convert to, default ether
 * @return {String|Object} When given a BN object it returns one as well, otherwise a number
 */
var fromWei = function(number, unit) {
    unit = getUnitValue(unit);

    if(!utils.isBN(number) && !_.isString(number)) {
        throw new Error('Please pass numbers as strings or BigNumber objects to avoid precision errors.');
    }

    return utils.isBN(number) ? ethjsUnit.fromWei(number, unit) : ethjsUnit.fromWei(number, unit).toString(10);
};

/**
 * Takes a number of a unit and converts it to wei.
 *
 * Possible units are:
 *   SI Short   SI Full        Effigy       Other
 * - kwei       femtoether     babbage
 * - mwei       picoether      lovelace
 * - gwei       nanoether      shannon      nano
 * - --         microether     szabo        micro
 * - --         microether     szabo        micro
 * - --         milliether     finney       milli
 * - ether      --             --
 * - kether                    --           grand
 * - mether
 * - gether
 * - tether
 *
 * @method toWei
 * @param {Number|String|BN} number can be a number, number string or a HEX of a decimal
 * @param {String} unit the unit to convert from, default ether
 * @return {String|Object} When given a BN object it returns one as well, otherwise a number
 */
var toWei = function(number, unit) {
    unit = getUnitValue(unit);

    if(!utils.isBN(number) && !_.isString(number)) {
        throw new Error('Please pass numbers as strings or BigNumber objects to avoid precision errors.');
    }

    return utils.isBN(number) ? ethjsUnit.toWei(number, unit) : ethjsUnit.toWei(number, unit).toString(10);
};

// For Klay unit
var unitKlayMap = {
    'peb': '1',
    'kpeb': '1000',
    'Mpeb': '1000000',
    'Gpeb': '1000000000',
    'Ston': '1000000000',
    'uKLAY': '1000000000000',
    'mKLAY': '1000000000000000',
    'KLAY': '1000000000000000000',
    'kKLAY': '1000000000000000000000',
    'MKLAY': '1000000000000000000000000',
    'GKLAY': '1000000000000000000000000000',
}

var unitKlayToEthMap = {
    'peb': 'wei',
    'kpeb': 'kwei',
    'Mpeb': 'mwei',
    'Gpeb': 'gwei',
    'Ston': 'gwei',
    'uKLAY': 'microether',
    'mKLAY': 'milliether',
    'KLAY': 'ether',
    'kKLAY': 'kether',
    'MKLAY': 'mether',
    'GKLAY': 'gether',
}
var getKlayUnitValue = function (unit) {
    unit = unit ? unit : 'KLAY';
    if (!unitKlayMap[unit]) {
        throw new Error('This unit "'+ unit +'" doesn\'t exist, please use the one of the following units' + JSON.stringify(unitKlayMap, null, 2));
    }
    return unit;
};

var fromPeb = function(number, unit) {
    // kaly unit to eth unit
    unit = getKlayUnitValue(unit);
    unit = unitKlayToEthMap[unit];

    unit = getUnitValue(unit);

    if (!utils.isBN(number) && !_.isString(number)) {
      number = tryNumberToString(number)
    }

    return utils.isBN(number) ? ethjsUnit.fromWei(number, unit) : ethjsUnit.fromWei(number, unit).toString(10);
};

var toPeb = function(number, unit) {
    // kaly unit to eth unit
    unit = getKlayUnitValue(unit);
    unit = unitKlayToEthMap[unit];

    unit = getUnitValue(unit);

    if (!utils.isBN(number) && !_.isString(number)) {
      number = tryNumberToString(number)
    }

    return utils.isBN(number) ? ethjsUnit.toWei(number, unit) : ethjsUnit.toWei(number, unit).toString(10);
};

function tryNumberToString(number) {
  try {
    return utils.toBN(number).toString(10)
  } catch (e) {
    throw new Error('Please pass numbers as strings or BigNumber objects to avoid precision errors.');
  }
}

/**
 * Converts to a checksum address
 *
 * @method toChecksumAddress
 * @param {String} address the given HEX address
 * @return {String}
 */
var toChecksumAddress = function (address) {
  if (typeof address === 'undefined') return ''

  if (!/^(0x)?[0-9a-f]{40}$/i.test(address))
    throw new Error('Given address "'+ address +'" is not a valid Klaytn address.')

  address = address.toLowerCase().replace(/^0x/i,'')
  var addressHash = utils.sha3(address).replace(/^0x/i,'')
  var checksumAddress = '0x'

  for (var i = 0; i < address.length; i++ ) {
    // If ith character is 9 to f then make it uppercase
    if (parseInt(addressHash[i], 16) > 7) {
      checksumAddress += address[i].toUpperCase()
    } else {
      checksumAddress += address[i]
    }
  }
  return checksumAddress
}

const isHexParameter = a => _.isString(a) && a.indexOf('0x') === 0

/**
 * Should be used to flatten json abi inputs/outputs into an array of type-representing-strings
 *
 * @method _flattenTypes
 * @param {bool} includeTuple
 * @param {Object} puts
 * @return {Array} parameters as strings
 */
function _flattenTypes (includeTuple, puts) {
  var types = []
   puts.forEach(function(param) {
     if (typeof param.components === 'object') {
        if (param.type.substring(0, 5) !== 'tuple') {
            throw new Error('components found but type is not tuple; report on GitHub');
        }
        var suffix = ''
        var arrayBracket = param.type.indexOf('[')
        if (arrayBracket >= 0) {
          suffix = param.type.substring(arrayBracket)
        }
        var result = _flattenTypes(includeTuple, param.components)

        if(_.isArray(result) && includeTuple) {
          types.push('tuple(' + result.join(',') + ')' + suffix)
        }
        else if(!includeTuple) {
          types.push('(' + result.join(',') + ')' + suffix)
        }
        else {
          types.push('(' + result + ')')
        }
    } else {
      types.push(param.type)
    }
  })
   return types;
};

module.exports = {
    _fireError: _fireError,
    _jsonInterfaceMethodToString: _jsonInterfaceMethodToString,
    _flattenTypes: _flattenTypes,
    // extractDisplayName: extractDisplayName,
    // extractTypeName: extractTypeName,
    randomHex: randomHex,
    _: _,
    soliditySha3: soliditySha3,
    toChecksumAddress: toChecksumAddress,
    hexToAscii: hexToAscii,
    toAscii: hexToAscii,
    asciiToHex: asciiToHex,
    fromAscii: asciiToHex,

    unitMap: unitKlayMap,
    toWei: toWei,
    fromWei: fromWei,

    // For Klay unit
    unitKlayMap: unitKlayMap,
    toPeb: toPeb,
    fromPeb: fromPeb,

    BN: utils.BN,
    isBN: utils.isBN,
    isBigNumber: utils.isBigNumber,
    isHex: utils.isHex,
    isHexStrict: utils.isHexStrict,
    sha3: utils.sha3,
    keccak256: utils.sha3,
    isAddress: utils.isAddress,
    checkAddressChecksum: utils.checkAddressChecksum,
    toHex: utils.toHex,
    toBN: utils.toBN,

    bytesToHex: utils.bytesToHex,
    hexToBytes: utils.hexToBytes,

    hexToNumberString: utils.hexToNumberString,

    hexToNumber: utils.hexToNumber,
    toDecimal: utils.hexToNumber, // alias

    numberToHex: utils.numberToHex,
    fromDecimal: utils.numberToHex, // alias

    hexToUtf8: utils.hexToUtf8,
    hexToString: utils.hexToUtf8,
    toUtf8: utils.hexToUtf8,

    utf8ToHex: utils.utf8ToHex,
    stringToHex: utils.utf8ToHex,
    fromUtf8: utils.utf8ToHex,
    padLeft: utils.leftPad,
    leftPad: utils.leftPad,
    padRight: utils.rightPad,
    rightPad: utils.rightPad,
    toTwosComplement: utils.toTwosComplement,
    // Moved promiEvent to utils,
    promiEvent: promiEvent,
    Iban: Iban,
    // Newly added for supporting rpc.js
    isHexParameter: isHexParameter,
    // Newly added for supporting of setting default block.
    parsePredefinedBlockNumber: utils.parsePredefinedBlockNumber,
    isPredefinedBlockNumber: utils.isPredefinedBlockNumber,
    isValidBlockNumberCandidate: utils.isValidBlockNumberCandidate,
    isValidPrivateKey: utils.isValidPrivateKey,
    isValidNSHSN: utils.isValidNSHSN,
    parsePrivateKey: utils.parsePrivateKey,
    isKlaytnWalletKey: utils.isKlaytnWalletKey,
    isContractDeployment: utils.isContractDeployment,
    // RLP
    rlpEncode: utils.rlpEncode,
    rlpDecode: utils.rlpDecode,
    xyPointFromPublicKey: utils.xyPointFromPublicKey,
    resolveSignature: utils.resolveSignature,
    getTxTypeStringFromRawTransaction: utils.getTxTypeStringFromRawTransaction,
    txTypeToString: utils.txTypeToString,
    trimLeadingZero: utils.trimLeadingZero,
    makeEven: utils.makeEven,
    isCompressedPublicKey: utils.isCompressedPublicKey,
    compressPublicKey: utils.compressPublicKey,
};
