import { Activity, FILTransaction, FILTransactionProcessing } from '../../shared/typings'
export type { FILTransactionStatus } from '../../shared/typings'
export type { Activity, FILTransaction, FILTransactionProcessing }

declare global {
  interface Window {
    electron: {
      stationBuildVersion: string;

      getAllActivities(): Promise<Activity[]>;

      getTotalJobsCompleted(): Promise<number>;
      onJobStatsUpdated (callback: (totalJobCount: number) => void): () => void;

      getUpdaterStatus(): Promise<{updateAvailable: boolean}>;
      openReleaseNotes(): void;
      restartToUpdate(): void;

      saturnNode: {
        start: () => Promise<void>;
        stop: () => Promise<void>;
        isRunning: () => Promise<boolean>;
        isReady: () => Promise<boolean>;
        getLog: () => Promise<string>;
        getWebUrl: () => Promise<string>;
        getFilAddress: () => Promise<string | undefined>;
        setFilAddress: (address: string | undefined) => Promise<void>;
      };
      stationConfig: {
        getOnboardingCompleted: () => Promise<boolean>;
        setOnboardingCompleted: () => Promise<void>;
        getStationWalletAddress: () => Promise<string>;
        getDestinationWalletAddress: () => Promise<string | undefined>;
        setDestinationWalletAddress: (address: string | undefined) => Promise<void>;
        getStationWalletBalance: () => Promise<string>;
        getStationWalletTransactionsHistory: () => Promise<(FILTransaction|FILTransactionProcessing)[]>;
        transferAllFundsToDestinationWallet: () => Promise<void>;
        browseTransactionTracker: (transactionHash: string) => void;
      };
      stationEvents: {
        onActivityLogged: (callback: (allActivities: Activity[]) => void) => () => void;
        onJobProcessed: (callback: (value: number) => void) => () => void;
        onEarningsChanged: (callback: (value: number) => void) => () => void;
        onUpdateAvailable: (callback: () => void) => () => void;
        onTransactionUpdate:
          (callback: (allTransactions: (FILTransaction|FILTransactionProcessing)[]) => void) => () => void;
        onBalanceUpdate: (callback: (balance: string) => void) => () => void;
      };
      dialogs: {
        confirmChangeWalletAddress: () => Promise<boolean>;
      };
    };
  }
}

export function isFILTransactionProcessing (
  tx: FILTransaction | FILTransactionProcessing
): tx is FILTransactionProcessing {
  return tx.status === 'processing'
}

export function isFILTransactionConfirmed (tx: FILTransaction | FILTransactionProcessing): tx is FILTransaction {
  return tx.status !== 'processing'
}
