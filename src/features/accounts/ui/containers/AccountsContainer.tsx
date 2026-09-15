/* Componente de LÓGICA: lee el store, liga acciones, no pinta nada.

   Es lo que sustituye al prop drilling — `App` y `DesktopShell` ya no le pasan
   `accounts`, `balances`, `onAdd` ni `onEdit`: se sirve solo. Y sigue sin ver
   una mónada: desde aquí, `openAccountForm` es `(account) => void`. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { computeBalances } from '../../domain/balance';
import { selectAccounts } from '../../store/selectors';
import { AccountsView } from '../components/AccountsView';
import { AccountsViewDesktop } from '../components/AccountsViewDesktop';

export type AccountsContainerProps = {
  desktop?: boolean;
};

export function AccountsContainer({ desktop }: AccountsContainerProps) {
  const accounts = useHiloStore(selectAccounts);
  const transactions = useHiloStore((s) => s.transactions);
  const openAccountForm = useHiloStore((s) => s.openAccountForm);
  const hideBalances = useHiloStore((s) => s.hideBalances);

  // `useMemo` y no un selector: `computeBalances` devuelve un objeto nuevo cada
  // vez, y zustand v5 compara por identidad. Es el mismo memo que tenía `App`.
  const balances = useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);

  const View = desktop ? AccountsViewDesktop : AccountsView;

  return (
    <View
      accounts={accounts}
      balances={balances}
      onAdd={() => openAccountForm(null)}
      onEdit={(account) => openAccountForm(account)}
      hideBalances={hideBalances}
    />
  );
}
