import React from 'react';
import {
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';

import * as Keychain from 'react-native-keychain';

import hathorLib from '@hathor/wallet-lib';
import { loadHistory, clearInitWallet } from '../actions';
import {
  Strong, setSupportedBiometry, getSupportedBiometry, setBiometryEnabled, isBiometryEnabled,
} from '../utils';
import { KEYCHAIN_USER } from '../constants';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';


/**
 * loadHistoryStatus {Object} progress on loading tx history {
 *   active {boolean} indicates we're loading the tx history
 *   error {boolean} error loading history
 * }
 * initWallet {Object} Information on wallet initialization (if not needed, set to null)
 *   words {str} wallet words
 *   pin {str} pin selected by user
 * }
 */
const mapStateToProps = state => ({
  loadHistoryStatus: state.loadHistoryStatus,
  initWallet: state.initWallet,
});

const mapDispatchToProps = dispatch => ({
  loadHistory: () => dispatch(loadHistory()),
  clearInitWallet: () => dispatch(clearInitWallet()),
});

class LoadHistoryScreen extends React.Component {
  state = {
    transactions: 0,
    addresses: 0,
  };

  componentDidMount() {
    // This setTimeout exists to prevent blocking the main thread
    setTimeout(() => this.initializeWallet(), 0);
  }

  componentWillUnmount() {
    hathorLib.WebSocketHandler.removeListener('addresses_loaded', this.addressesLoadedUpdate);
    this.props.clearInitWallet();
  }

  /**
   * Method called when WebSocket receives a message after loading address history
   * We just update redux data with new loading info
   *
   * @param {Object} data Object with {'historyTransactions', 'addressesFound'}
   */
  addressesLoadedUpdate = (data) => {
    const txs = Object.keys(data.historyTransactions).length;
    const addresses = data.addressesFound;
    this.setState({ transactions: txs, addresses });
  }

  cleanData = () => {
    // Get old access data
    const accessData = hathorLib.storage.getItem('wallet:accessData');
    const walletData = hathorLib.wallet.getWalletData();
    const server = hathorLib.storage.getItem('wallet:server');
    const tokens = hathorLib.storage.getItem('wallet:tokens');

    const biometryEnabled = isBiometryEnabled();
    const supportedBiometry = getSupportedBiometry();
    hathorLib.storage.clear();

    const newWalletData = {
      keys: {},
      xpubkey: walletData.xpubkey,
    };

    hathorLib.storage.setItem('wallet:accessData', accessData);
    hathorLib.storage.setItem('wallet:data', newWalletData);
    hathorLib.storage.setItem('wallet:server', server);
    hathorLib.storage.setItem('wallet:tokens', tokens);
    setBiometryEnabled(biometryEnabled);
    setSupportedBiometry(supportedBiometry);
  }

  initializeWallet() {
    if (this.props.initWallet) {
      const { words, pin } = this.props.initWallet;

      // This is the slow step. It takes around 3s in Pedro's iPhone.
      hathorLib.wallet.executeGenerateWallet(words, '', pin, pin, false);
      // ------

      Keychain.setGenericPassword(KEYCHAIN_USER, pin, {
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
    } else {
      // lib already handles the case where websocket is already setup
      hathorLib.WebSocketHandler.setup();
    }
    hathorLib.WebSocketHandler.on('addresses_loaded', this.addressesLoadedUpdate);
    this.cleanData();
    this.props.loadHistory();
  }

  render() {
    const renderError = () => (
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          fontSize: 18, lineHeight: 22, width: 200, textAlign: 'center'
        }}
        >
          There&apos;s been an error connecting to the server
        </Text>
        <SimpleButton
          containerStyle={{ marginTop: 12 }}
          textStyle={{ fontSize: 18 }}
          onPress={this.props.loadHistory}
          title='Try again'
        />
      </View>
    );

    const renderLoading = () => (
      <View style={{ alignItems: 'center' }}>
        <Spinner size={48} animating />
        <Text style={[styles.text, { marginTop: 32, color: 'rgba(0, 0, 0, 0.5)' }]}>
          Loading your transactions
        </Text>
        <Text style={[styles.text, { marginTop: 24 }]}>
          <Strong>{`${this.state.transactions} transactions`}</Strong> found
        </Text>
        <Text style={styles.text}>
          <Strong>{`${this.state.addresses} addresses`}</Strong> found
        </Text>
      </View>
    );

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {this.props.loadHistoryStatus.error ? renderError() : renderLoading()}
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(LoadHistoryScreen);
