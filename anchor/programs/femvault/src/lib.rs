use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod femvault {
    use super::*;

    pub fn grant_access(
        ctx: Context<GrantAccess>,
        record_hash: [u8; 32],
        expires_at: i64,
    ) -> Result<()> {
        let permission = &mut ctx.accounts.permission;
        let clock = Clock::get()?;

        require!(expires_at > clock.unix_timestamp, FemVaultError::InvalidExpiration);

        permission.patient = ctx.accounts.patient.key();
        permission.doctor = ctx.accounts.doctor.key();
        permission.record_hash = record_hash;
        permission.expires_at = expires_at;
        permission.revoked = false;
        permission.bump = ctx.bumps.permission;

        emit!(AccessGranted {
            patient: permission.patient,
            doctor: permission.doctor,
            record_hash,
            expires_at,
        });

        Ok(())
    }

    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        let permission = &mut ctx.accounts.permission;
        permission.revoked = true;

        emit!(AccessRevoked {
            patient: permission.patient,
            doctor: permission.doctor,
            record_hash: permission.record_hash,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(record_hash: [u8; 32])]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub patient: Signer<'info>,

    /// CHECK: doctor only needs to be identified by public key
    pub doctor: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = patient,
        space = 8 + AccessPermission::INIT_SPACE,
        seeds = [b"permission", patient.key().as_ref(), doctor.key().as_ref(), record_hash.as_ref()],
        bump
    )]
    pub permission: Account<'info, AccessPermission>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    #[account(mut)]
    pub patient: Signer<'info>,

    #[account(
        mut,
        has_one = patient @ FemVaultError::UnauthorizedPatient
    )]
    pub permission: Account<'info, AccessPermission>,
}

#[account]
#[derive(InitSpace)]
pub struct AccessPermission {
    pub patient: Pubkey,
    pub doctor: Pubkey,
    pub record_hash: [u8; 32],
    pub expires_at: i64,
    pub revoked: bool,
    pub bump: u8,
}

#[event]
pub struct AccessGranted {
    pub patient: Pubkey,
    pub doctor: Pubkey,
    pub record_hash: [u8; 32],
    pub expires_at: i64,
}

#[event]
pub struct AccessRevoked {
    pub patient: Pubkey,
    pub doctor: Pubkey,
    pub record_hash: [u8; 32],
}

#[error_code]
pub enum FemVaultError {
    #[msg("Expiration must be in the future")]
    InvalidExpiration,
    #[msg("Only the patient who created the permission can revoke it")]
    UnauthorizedPatient,
}
