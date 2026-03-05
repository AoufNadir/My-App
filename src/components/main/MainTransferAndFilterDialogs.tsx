import type { ComponentProps } from 'react';
import {
    ClientTransferDialog,
    TreasuryBalanceEditDialog,
    PortfolioBalanceEditDialog,
    DateFilterDialog
} from './MainDialogs';

type MainTransferAndFilterDialogsProps = {
    clientTransferProps: ComponentProps<typeof ClientTransferDialog>;
    treasuryBalanceEditProps: ComponentProps<typeof TreasuryBalanceEditDialog>;
    portfolioBalanceEditProps: ComponentProps<typeof PortfolioBalanceEditDialog>;
    dateFilterProps: ComponentProps<typeof DateFilterDialog>;
};

export function MainTransferAndFilterDialogs({
    clientTransferProps,
    treasuryBalanceEditProps,
    portfolioBalanceEditProps,
    dateFilterProps
}: MainTransferAndFilterDialogsProps) {
    return (
        <>
            <ClientTransferDialog {...clientTransferProps} />
            <TreasuryBalanceEditDialog {...treasuryBalanceEditProps} />
            <PortfolioBalanceEditDialog {...portfolioBalanceEditProps} />
            <DateFilterDialog {...dateFilterProps} />
        </>
    );
}
