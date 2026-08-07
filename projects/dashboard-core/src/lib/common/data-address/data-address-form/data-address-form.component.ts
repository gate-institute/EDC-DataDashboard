/*
 *  Copyright (c) 2025 Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.
 *
 *  This program and the accompanying materials are made available under the
 *  terms of the Apache License, Version 2.0 which is available at
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 *  SPDX-License-Identifier: Apache-2.0
 *
 *  Contributors:
 *       Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V. - initial API and implementation
 *
 */

import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataAddress } from '@think-it-labs/edc-connector-client';
import { URL_REGEX } from '../../../models/constants';

export type DataplaneMetadataFormValue = {
  type?: string;
  method?: string;
  url?: string;
  ttl?: number | string;
  authType?: 'none' | 'basic' | 'apiKey';
  username?: string;
  password?: string;
  apiKey?: string;
  customHeaders?: string;
};

@Component({
  selector: 'lib-data-address-form',
  templateUrl: './data-address-form.component.html',
  imports: [ReactiveFormsModule, NgClass],
})
export class DataAddressFormComponent implements OnChanges, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();

  @Input() showDivider = true;
  @Input() parentForm?: FormGroup;
  @Input() initialValue?: DataplaneMetadataFormValue;
  @Output() dataAddressChange = new EventEmitter<DataAddress>();

  private readonly FORM_GROUP_NAME = 'dataplaneMetadata';
  dataplaneMetadataForm: FormGroup;

  showPassword = false;
  showApiKey = false;

  constructor() {
    this.dataplaneMetadataForm = this.formBuilder.group({
      type: ['HttpData', Validators.required],
      method: ['GET'],
      url: ['', [Validators.required, Validators.pattern(URL_REGEX)]],
      ttl: [600],
      authType: ['none'],
      username: [''],
      password: [''],
      apiKey: [''],
      customHeaders: [''],
    });

    this.dataplaneMetadataForm
      .get('authType')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(authType => {
        this.showPassword = false;
        this.showApiKey = false;
        this.updateAuthValidators(authType);
      });

    this.dataplaneMetadataForm
      .get('customHeaders')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.validateCustomHeaders();
      });

    this.dataplaneMetadataForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
      if (!value.url) return;

      const dataAddress = {
        type: value.type || 'HttpData',
        method: value.method || 'GET',
        url: value.url,
      } as DataAddress;
      this.dataAddressChange.emit(dataAddress);
    });
  }

  ngOnChanges() {
    this.parentForm?.setControl(this.FORM_GROUP_NAME, this.dataplaneMetadataForm);
    if (this.initialValue) {
      this.dataplaneMetadataForm.patchValue(this.initialValue);
    }
  }

  private updateAuthValidators(authType: string): void {
    const username = this.dataplaneMetadataForm.get('username');
    const password = this.dataplaneMetadataForm.get('password');
    const apiKey = this.dataplaneMetadataForm.get('apiKey');

    username?.setValidators(authType === 'basic' ? [Validators.required] : []);
    password?.setValidators(authType === 'basic' ? [Validators.required] : []);
    apiKey?.setValidators(authType === 'apiKey' ? [Validators.required] : []);
    username?.updateValueAndValidity({ emitEvent: false });
    password?.updateValueAndValidity({ emitEvent: false });
    apiKey?.updateValueAndValidity({ emitEvent: false });
  }

  private validateCustomHeaders(): void {
    const control = this.dataplaneMetadataForm.get('customHeaders');

    if (!control?.value) {
      control?.setErrors(null);
      return;
    }

    try {
      const headers = JSON.parse(`{${control.value}}`);

      if (
        typeof headers !== 'object' ||
        Object.values(headers).some(value => typeof value !== 'string')
      ) {
        throw new Error();
      }

      control.setErrors(null);
    } catch {
      control.setErrors({ invalidHeaders: true });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.parentForm?.removeControl(this.FORM_GROUP_NAME);
  }
}
