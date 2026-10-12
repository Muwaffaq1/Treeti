'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, LoaderCircle, CalendarDays, ChevronDown, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import {cloneElement,isValidElement,useId,useRef} from 'react';
import type { ButtonHTMLAttributes, ReactNode, ReactElement, RefObject } from 'react';
export function Button({children,className,variant='primary',busy,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger';busy?:boolean}){return <button {...props} disabled={props.disabled||busy} className={clsx('button',`button-${variant}`,className)}>{busy&&<LoaderCircle className="spinner" size={17} aria-hidden/>}{children}</button>;}
export function Modal({open,onOpenChange,title,description,children,returnFocus}:{open:boolean;onOpenChange:(value:boolean)=>void;title:string;description?:string;children:ReactNode;returnFocus?:RefObject<HTMLElement|null>}){
  const previousFocus=useRef<HTMLElement|null>(null),descriptionId=useId();
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay"/><DialogPrimitive.Content className="dialog-content" aria-describedby={description?descriptionId:undefined} onOpenAutoFocus={()=>{previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={event=>{event.preventDefault();const target=returnFocus?.current??previousFocus.current;if(target?.isConnected)target.focus();}}><div className="dialog-heading"><DialogPrimitive.Title>{title}</DialogPrimitive.Title><DialogPrimitive.Close className="icon-button" aria-label="Close dialog"><X size={20} aria-hidden/></DialogPrimitive.Close></div>{description&&<DialogPrimitive.Description id={descriptionId}>{description}</DialogPrimitive.Description>}{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
export function ErrorMessage({message}:{message:string}){return message?<p className="error-message" role="alert">{message}</p>:null;}
export function DisclosureSummary({children}:{children:ReactNode}){return <summary className="disclosure-summary"><span className="disclosure-label">{children}</span><ChevronDown className="disclosure-chevron" size={18} aria-hidden/></summary>;}
export function Field({label,children,hint,error,icon}:{label:string;children:ReactNode;hint?:string;error?:string;icon?:LucideIcon}){
  const id=useId(),element=isValidElement(children)?children as ReactElement<Record<string,unknown>>:null;
  const native=element&&typeof element.type==='string'&&['input','textarea','select'].includes(element.type);
  const isSelect=element?.type==='select',Icon=icon??(element?.props.type==='date'||element?.props.type==='datetime-local'?CalendarDays:undefined);
  const control=element?cloneElement(element,{'aria-invalid':error?true:element.props['aria-invalid'],'aria-describedby':hint||error?`${id}-hint`:element.props['aria-describedby'],...(native?{id:element.props.id??id}:{})}):children;
  return <div className="field">{native?<label className="field-label" htmlFor={String(element?.props.id??id)}>{label}</label>:<span className="field-label">{label}</span>}{native?<span className={clsx('field-control',Icon&&'has-leading-icon',isSelect&&'is-select',element?.type==='textarea'&&'is-textarea')}>{Icon&&<Icon size={20} className="field-leading-icon" aria-hidden/>}{control}{isSelect&&<ChevronDown size={18} className="field-trailing-icon" aria-hidden/>}</span>:control}<span id={`${id}-hint`}>{hint&&<small>{hint}</small>}{error&&<small className="field-error" role="alert">{error}</small>}</span></div>;
}
